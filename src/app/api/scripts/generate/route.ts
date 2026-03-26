import { NextRequest, NextResponse } from "next/server";
import { callGemini, buildChatPrompt } from "@/lib/gemini";

// 脚本类型配置
const SCRIPT_TYPE_CONFIG: Record<string, {
  structure: string;
  description: string;
}> = {
  teach: {
    structure: "问题 → 解决方案 → 效果",
    description: "先抛出痛点，再给出方法，最后展示效果"
  },
  show: {
    structure: "场景 → 过程 → 结果",
    description: "展示真实场景，记录操作过程，呈现最终结果"
  },
  opinion: {
    structure: "现象 → 观点 → 共鸣",
    description: "描述社会现象，表达鲜明观点，引发情感共鸣"
  },
  story: {
    structure: "冲突 → 转折 → 结局",
    description: "设置戏剧冲突，制造意外转折，给出圆满结局"
  }
};

// 薛辉8大爆款元素及钩子词根
const VIRAL_ELEMENTS: Record<string, { name: string; description: string; hooks: string[] }> = {
  cost: {
    name: "成本",
    description: "省钱、省时、省力、性价比",
    hooks: ["花小钱装大杯", "省时省钱省力", "平替", "白嫖", "一招搞定", "9.9元"]
  },
  crowd: {
    name: "人群",
    description: "精准人群标签，引发身份认同",
    hooks: ["宝妈", "程序员", "打工人", "小个子", "巨蟹座", "处女座"]
  },
  curiosity: {
    name: "好奇",
    description: "制造悬念，激发求知欲",
    hooks: ["反常识", "万万没想到", "揭秘", "黑科技", "冷知识", "据说"]
  },
  contrast: {
    name: "反差",
    description: "强烈的对比和转折",
    hooks: ["身份错位", "场景反差", "没想到你是这样的", "居然", "竟然"]
  },
  worst: {
    name: "负面",
    description: "利用负面情绪制造共鸣",
    hooks: ["最丢脸", "最没面子", "避坑", "千万别买", "全网最低分"]
  },
  authority: {
    name: "权威",
    description: "借助权威背书增加可信度",
    hooks: ["明星同款", "大佬揭秘", "爱马仕工艺", "CCTV报道", "首富思维"]
  },
  nostalgia: {
    name: "怀旧",
    description: "唤起回忆，产生情感共鸣",
    hooks: ["童年回忆", "20年前", "小时候", "老味道", "经典复刻", "爷青回"]
  },
  hormone: {
    name: "荷尔蒙",
    description: "情感、两性关系相关",
    hooks: ["找对象", "脱单", "渣男鉴别", "分手", "前任", "夫妻关系"]
  }
};

// 时长对应字数
const DURATION_WORD_COUNT: Record<number, { min: number; max: number }> = {
  30: { min: 110, max: 140 },
  45: { min: 170, max: 210 },
  60: { min: 230, max: 270 }
};

const getSystemPrompt = (
  userIndustry: string,
  videoGoal: string,
  scriptType: string,
  viralElements: string[],
  selectedHooks: string[],
  videoDuration: number
) => {
  const scriptConfig = SCRIPT_TYPE_CONFIG[scriptType] || SCRIPT_TYPE_CONFIG.teach;
  const wordCount = DURATION_WORD_COUNT[videoDuration] || DURATION_WORD_COUNT[30];

  // 获取选中元素对应的钩子词根
  const selectedElements = viralElements.map(key => ({
    key,
    name: VIRAL_ELEMENTS[key]?.name || key,
    description: VIRAL_ELEMENTS[key]?.description || "",
    hooks: VIRAL_ELEMENTS[key]?.hooks || []
  }));

  return `你是一位专业的短视频口播脚本创作专家，精通薛辉短视频架构方法论。

【最高优先级任务】
你是严格的字数控制专家，你的首要任务是确保脚本字数精确达标。
在生成脚本后，你必须：
1. 数一下你的 script 有多少字
2. 如果超过 ${wordCount.max} 字，立即删除废话、重复、冗余表达
3. 如果不足 ${wordCount.min} 字，补充核心信息
4. 只有字数达标后，才能输出JSON

【字数范围】${wordCount.min}-${wordCount.max} 字（误差±10字可接受）
当前字数规则：${videoDuration}秒 = 约 ${wordCount.max} 字，平均每秒 ${Math.round(wordCount.max / videoDuration)} 字

【用户信息】
- 行业领域：${userIndustry}
- 视频目的：${videoGoal}

【脚本类型】
- 类型：${scriptType}
- 结构：${scriptConfig.structure}
- 展开方式：${scriptConfig.description}

【选中的爆款元素】
${selectedElements.map(e => `- ${e.name}（${e.description}）：${e.hooks.join('、')}`).join('\n')}

【用户勾选的钩子词根】
${selectedHooks.length > 0 ? selectedHooks.map(h => `- ${h}`).join('\n') : '（用户未勾选，请从选中元素的钩子词根中选择）'}

【口播脚本结构要求】

1. **开头钩子（前3秒，约15-20字）**
   - 必须使用用户勾选的钩子词根造句（如果用户勾选了）
   - 如果用户未勾选，请从选中元素的钩子词根中选择合适的
   - 制造悬念或冲突，抓住观众注意力

2. **中间内容（占60%时长，约${Math.round(wordCount.min * 0.6)}-${Math.round(wordCount.max * 0.6)}字）**
   - 根据${scriptType}类型展开：${scriptConfig.description}
   - 内容要与"${userIndustry}"行业相关
   - 引导用户"${videoGoal}"

3. **结尾引导（最后3-5秒，约15-20字）**
   - 明确的行动号召（点击/关注/来店/私信）
   - 制造紧迫感或利益点

【输出格式】
请严格按照以下JSON格式返回：

\`\`\`json
{
  "title": "选题标题（用钩子词根造句）",
  "script": "完整的口播文案（纯文本，不要分镜描述）",
  "wordCount": 实际字数,
  "estimatedDuration": 预估秒数,
  "openingHook": "开头钩子文案",
  "mainContent": "中间内容文案",
  "closingCTA": "结尾行动号召",
  "usedHooks": ["用到的钩子词根1", "用到的钩子词根2"]
}
\`\`\`

**注意**：
- 开头第一句必须使用钩子词根
- 只输出纯口播文案，不需要分镜描述
- 结尾必须有明确的行动号召
- 内容要符合"${userIndustry}"行业特点

【强制性字数红线 - 违者扣分】
1. 你当前生成的脚本必须严格符合 ${videoDuration} 秒的要求。
2. 目标字数范围：${wordCount.min} - ${wordCount.max} 字。
3. **严禁超过 ${wordCount.max} 字**！如果超过，视频将无法生成。
4. 请用最简练的语言表达，去掉所有废话。
`;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      userIndustry,
      videoGoal,
      scriptType, 
      viralElements, 
      selectedHooks,
      videoDuration, duration: durationParam,
      topic 
    } = body;

    // 参数验证
    if (!userIndustry || !videoGoal) {
      return NextResponse.json(
        { error: "缺少必要参数：userIndustry 或 videoGoal" },
        { status: 400 }
      );
    }

    const scriptKey = scriptType || "teach";
    const duration = durationParam || videoDuration || 30;
    const elements = viralElements || [];
    const hooks = selectedHooks || [];

    // 获取字数配置（提前定义，用于 userPrompt）
    const wordCount = DURATION_WORD_COUNT[duration] || DURATION_WORD_COUNT[30];

    // 构建用户输入
    const userPrompt = topic 
      ? `【选题信息】
标题：${topic.title}
冲突点：${topic.conflict_point || topic.conflictPoint}
情绪钩子：${topic.emotion_hook || topic.emotionHook}

请基于以上选题，生成口播脚本。

重要：请先生成脚本，然后自己检查字数。如果超过 ${wordCount.max} 字，请主动删除冗余内容，确保字数在 ${wordCount.min}-${wordCount.max} 之间。`
      : `请根据行业"${userIndustry}"和视频目的"${videoGoal}"，结合选中的爆款元素和钩子词根，生成一个口播脚本。

重要：请先生成脚本，然后自己检查字数。如果超过 ${wordCount.max} 字，请主动删除冗余内容，确保字数在 ${wordCount.min}-${wordCount.max} 之间。`;

    // 调用Gemini
    const responseText = await callGemini(
      buildChatPrompt(
        getSystemPrompt(userIndustry, videoGoal, scriptKey, elements, hooks, duration), 
        userPrompt
      )
    );

    // 解析JSON
    let scriptData;
    try {
      const content = responseText;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                        content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      scriptData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("JSON解析错误:", parseError);
      // 如果解析失败，使用原始文本
      scriptData = {
        title: "口播脚本",
        script: responseText,
        wordCount: responseText.length,
        estimatedDuration: Math.ceil(responseText.length / 4.5),
        openingHook: responseText.substring(0, 30),
        mainContent: responseText.substring(30),
        closingCTA: "",
        usedHooks: []
      };
    }

    // 智能裁剪：按句子截断，保持文案完整
    const durationLimit = DURATION_WORD_COUNT[duration] || DURATION_WORD_COUNT[30];
    if (scriptData.script && scriptData.script.length > durationLimit.max) {
      console.log(`[系统拦截] ${duration}秒视频不能有 ${scriptData.script.length} 个字，正在智能裁剪...`);
      const sentences = scriptData.script.split(/(?<=[。！？，,!?])/);
      let result = "";
      for (const s of sentences) {
        if ((result + s).length <= durationLimit.max) {
          result += s;
        } else {
          break;
        }
      }
      scriptData.script = result || scriptData.script.substring(0, durationLimit.max);
    }
    // 验证字数
    let finalScript = scriptData.script || "";
    const actualWordCount = finalScript.length;
    
    // 字数检查结果
    const isWordCountValid = actualWordCount >= wordCount.min && actualWordCount <= wordCount.max;
    
    if (!isWordCountValid) {
      console.warn(`字数不符合要求: ${actualWordCount} 目标: ${wordCount.min}-${wordCount.max}`);
    }

    return NextResponse.json({
      success: true,
      script: {
        id: `script_${Date.now()}`,
        title: scriptData.title || "口播脚本",
        script: finalScript,
        wordCount: actualWordCount,
        estimatedDuration: Math.ceil(actualWordCount / 4.5),
        openingHook: scriptData.openingHook || "",
        mainContent: scriptData.mainContent || "",
        closingCTA: scriptData.closingCTA || "",
        usedHooks: scriptData.usedHooks || [],
        targetWordCount: wordCount,
        wordCountValid: isWordCountValid, // 新增：字数是否达标
        wordCountWarning: !isWordCountValid ? `目标字数: ${wordCount.min}-${wordCount.max}，实际: ${actualWordCount}` : null
      }
    });

  } catch (error) {
    console.error("脚本生成失败:", error);
    return NextResponse.json(
      { error: "脚本生成失败，请稍后重试" },
      { status: 500 }
    );
  }
}
