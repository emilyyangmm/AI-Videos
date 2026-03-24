import { NextRequest, NextResponse } from "next/server";
import { callGemini, buildChatPrompt } from "@/lib/gemini";

// 7种爆款标题风格定义
const TITLE_STYLES = [
  {
    id: "suspense",
    name: "悬念/好奇型",
    logic: "用问句/省略引发好奇",
    patterns: ["…吗？", "…怎么回事？", "…真相是？", "到底有多…？"],
    emotion: "好奇心",
    example: "老土著偷偷去的夜市摊，9.9元黑暗料理到底有多野？"
  },
  {
    id: "authority",
    name: "权威/揭秘型",
    logic: "用'我发现了'、'扒光'、'真相'建立信任",
    patterns: ["我扒光了…", "揭秘…", "99%的人不知道", "终于挖出…"],
    emotion: "求知欲",
    example: "我采访了10个老土著，终于挖出这份9.9元黑暗料理地图"
  },
  {
    id: "trend",
    name: "从众/热点型",
    logic: "用'全网'、'疯抢'制造紧迫感",
    patterns: ["全网都在…", "…疯抢", "…爆火", "最近都在…"],
    emotion: "从众心理",
    example: "最近老土著都在疯抢！9.9元解锁黑暗料理新世界"
  },
  {
    id: "contrast",
    name: "冲突/反差型",
    logic: "用'千万别'、'竟然'制造意外",
    patterns: ["千万别…，否则…", "…竟然…", "反向…", "颠覆认知…"],
    emotion: "意外感",
    example: "千万别信老土著的推荐！9.9元黑暗料理吃完我沉默了"
  },
  {
    id: "tutorial",
    name: "实用/教程型",
    logic: "用'一招'、'教你'提供价值",
    patterns: ["一招搞定…", "手把手教你…", "3个必点…", "跟着…点单"],
    emotion: "获得感",
    example: "跟着老土著点单：9.9元吃垮黑暗料理摊的3个必点秘籍"
  },
  {
    id: "pain",
    name: "痛点/避坑型",
    logic: "用'后悔'、'踩雷'直击焦虑",
    patterns: ["我踩雷了…", "后悔才知道…", "这样吃才不踩雷", "避坑指南…"],
    emotion: "安全感",
    example: "9.9元买的黑暗料理，老土著教我这样吃才不踩雷"
  },
  {
    id: "emotion",
    name: "情感/共鸣型",
    logic: "用'我们'、'谁懂啊'引发共情",
    patterns: ["只有…才懂", "谁懂啊，…", "回不去的…", "是…的青春"],
    emotion: "归属感",
    example: "只有老土著才懂：那一口9.9元的黑暗料理，是回不去的青春"
  }
];

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

const getSystemPrompt = (duration: number) => {
  return `你是一位专业的短视频爆款标题策划专家，精通薛辉短视频架构方法论。

【核心任务】
基于用户提供的行业、视频目的和钩子词根，生成3个完整的爆款选题方案。
每个选题方案需包含7种不同风格的标题变体（对应7种用户心理）。

【7种标题风格定义】
1. 悬念/好奇型：用问句或省略引发好奇心，情绪：好奇心
2. 权威/揭秘型：用"揭秘"、"我发现了"等建立信任感，情绪：求知欲
3. 从众/热点型：用"疯抢"、"全网"制造从众心理，情绪：从众心理
4. 冲突/反差型：用"千万别"、"竟然"制造意外感，情绪：意外感
5. 实用/教程型：用"一招"、"教你"提供具体价值，情绪：获得感
6. 痛点/避坑型：用"踩雷"、"后悔"直击焦虑，情绪：安全感
7. 情感/共鸣型：用"只有…才懂"引发共情，情绪：归属感

【时长适配】
视频时长${duration}秒，${duration <= 30 ? '推荐更直接、冲击力强的选题' : '可适当增加情感铺垫和故事性'}

请以JSON格式返回：
{
  "topics": [
    {
      "title": "主标题（综合最佳）",
      "conflictPoint": "核心冲突",
      "emotionHook": "情绪钩子",
      "type": "选题类型",
      "styleVariants": [
        {
          "styleId": "suspense",
          "styleName": "悬念/好奇型",
          "title": "标题变体",
          "conflict": "该风格冲突点",
          "emotion": "该风格情绪钩子"
        }
      ]
    }
  ]
}`;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      userIndustry,
      videoGoal,
      selectedHooks,
      viralElements,
      videoDuration 
    } = body;
    
    const duration = videoDuration || 30;

    if (!userIndustry || !videoGoal) {
      return NextResponse.json(
        { error: "缺少必要参数：userIndustry 或 videoGoal" },
        { status: 400 }
      );
    }

    // 获取选中的钩子词根
    const hooksList = selectedHooks && selectedHooks.length > 0 
      ? selectedHooks 
      : (viralElements || []).flatMap((key: string) => VIRAL_ELEMENTS[key]?.hooks || []);

    const userPrompt = `【选题生成任务】

行业领域：${userIndustry}
视频目的：${videoGoal}
视频时长：${duration}秒

【选中的钩子词根】
${hooksList.map((h: string) => `- ${h}`).join('\n')}

请基于以上信息，生成3个完整的爆款选题方案，每个方案包含7种不同风格的标题变体。选题要与"${userIndustry}"行业相关，引导用户"${videoGoal}"。`;

    // 调用Gemini
    const responseText = await callGemini(
      buildChatPrompt(getSystemPrompt(duration), userPrompt)
    );

    // 解析LLM返回的JSON
    let topicsData;
    try {
      const content = responseText;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                        content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      topicsData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("JSON解析错误:", parseError);
      topicsData = { topics: [] };
    }

    console.log("[DB] 保存选题:", { industry: userIndustry, topicsCount: topicsData.topics?.length || 0 });

    return NextResponse.json({
      success: true,
      topics: topicsData.topics || [],
      titleStyles: TITLE_STYLES
    });
  } catch (error) {
    console.error("选题生成失败:", error);
    return NextResponse.json(
      { error: "选题生成失败，请稍后重试" },
      { status: 500 }
    );
  }
}

// 换一批选题（重新生成）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      userIndustry,
      videoGoal,
      selectedHooks,
      viralElements,
      videoDuration 
    } = body;
    
    const duration = videoDuration || 30;

    if (!userIndustry || !videoGoal) {
      return NextResponse.json(
        { error: "缺少必要参数：userIndustry 或 videoGoal" },
        { status: 400 }
      );
    }

    // 获取选中的钩子词根
    const hooksList = selectedHooks && selectedHooks.length > 0 
      ? selectedHooks 
      : (viralElements || []).flatMap((key: string) => VIRAL_ELEMENTS[key]?.hooks || []);

    const userPrompt = `【选题重新生成任务】请生成完全不同的选题

行业领域：${userIndustry}
视频目的：${videoGoal}
视频时长：${duration}秒

【选中的钩子词根】
${hooksList.map((h: string) => `- ${h}`).join('\n')}

请生成3个完全不同的爆款选题方案（与之前的不同），每个方案包含7种不同风格的标题变体。选题要与"${userIndustry}"行业相关，引导用户"${videoGoal}"。`;

    // 调用Gemini
    const responseText = await callGemini(
      buildChatPrompt(getSystemPrompt(duration), userPrompt)
    );

    // 解析并保存新选题
    let topicsData;
    try {
      const content = responseText;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                        content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      topicsData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("JSON解析错误:", parseError);
      topicsData = { topics: [] };
    }

    console.log("[DB] 重新生成选题:", { industry: userIndustry, topicsCount: topicsData.topics?.length || 0 });

    return NextResponse.json({
      success: true,
      topics: topicsData.topics || [],
      titleStyles: TITLE_STYLES
    });
  } catch (error) {
    console.error("重新生成选题失败:", error);
    return NextResponse.json(
      { error: "重新生成选题失败，请稍后重试" },
      { status: 500 }
    );
  }
}
