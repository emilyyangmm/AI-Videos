import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { callGemini } from "@/lib/gemini";

const ELEMENT_NAMES: Record<string, string> = {
  cost: "成本维度", crowd: "人群维度", curiosity: "猎奇维度",
  contrast: "反差维度", worst: "最差元素", authority: "头牌效应",
  nostalgia: "怀旧元素", hormone: "荷尔蒙驱动",
};

const SCRIPT_TYPE_NAMES: Record<string, string> = {
  teach: "教知识（问题→解决方案→效果）",
  show: "晒过程（场景→过程→结果）",
  opinion: "聊观点（现象→观点→共鸣）",
  story: "讲故事（冲突→转折→结局）",
};

export async function POST(request: NextRequest) {
  try {
    const userInfo = getUserFromRequest(request);
    if (!userInfo) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const body = await request.json();
    const { industry, goal, duration, scriptType, viralElements, selectedHooks, targetWords } = body;

    if (!industry || !goal || !scriptType || !viralElements?.length) {
      return NextResponse.json({ success: false, error: "参数不完整" }, { status: 400 });
    }

    const elementNames = (viralElements as string[]).map(id => ELEMENT_NAMES[id] || id).join("、");
    const hooksText = selectedHooks?.length ? selectedHooks.join("、") : "无";
    const scriptTypeName = SCRIPT_TYPE_NAMES[scriptType] || scriptType;

    const prompt = `你是薛辉老师的学生，精通短视频爆款营销文案创作。请根据以下信息，生成一篇完整的短视频口播营销文案。

## 基本信息
- 行业：${industry}
- 视频目的：${goal}
- 视频时长：${duration}秒（约${targetWords?.min || 110}~${targetWords?.max || 140}字）
- 脚本类型：${scriptTypeName}

## 薛老师爆款元素（必须融入）
- 选用元素：${elementNames}
- 钩子词根（必须在开头第一句用上）：${hooksText}

## 写作要求
1. 开头第一句必须使用钩子词根，3秒内抓住注意力
2. 严格按照"${scriptTypeName.split("（")[0]}"结构展开
3. 口语化表达，适合视频口播
4. 字数严格控制在${targetWords?.min || 110}~${targetWords?.max || 140}字之间
5. 结尾必须有明确的行动号召（关注/评论/购买/到店等）

## 输出格式（严格按此JSON格式输出，不要有其他文字）
{
  "title": "视频标题（15字以内，吸引人点击）",
  "openingHook": "开头钩子文案（前3秒，用上钩子词根）",
  "mainContent": "中间内容（价值输出，多行用\\n分隔）",
  "closingCTA": "结尾行动号召",
  "fullScript": "完整口播脚本（openingHook+mainContent+closingCTA的完整版，自然连贯）",
  "usedHooks": ["实际用到的钩子词根列表"]
}`;

    const raw = await callGemini(prompt);

    // 提取JSON
    let jsonStr = raw;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // 如果解析失败，构造基本结构
      parsed = {
        title: `${industry}营销文案`,
        openingHook: raw.substring(0, 50),
        mainContent: raw.substring(50, raw.length - 30),
        closingCTA: raw.substring(raw.length - 30),
        fullScript: raw,
        usedHooks: selectedHooks?.slice(0, 2) || [],
      };
    }

    const copy = {
      ...parsed,
      wordCount: (parsed.fullScript || "").length,
      usedElements: viralElements,
    };

    return NextResponse.json({ success: true, copy });
  } catch (error: any) {
    console.error("[营销文案] 生成错误:", error);
    return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
}
