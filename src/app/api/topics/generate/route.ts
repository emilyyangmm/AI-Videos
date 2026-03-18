import { NextRequest, NextResponse } from "next/server";
import { LLMClient, Config, HeaderUtils } from "coze-coding-dev-sdk";
import { getSupabaseClient } from "@/storage/database/supabase-client";

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

// 商户类型偏好风格
const MERCHANT_STYLE_PREFERENCE: Record<string, string[]> = {
  ecommerce: ["pain", "tutorial", "authority", "contrast", "suspense", "trend", "emotion"],
  local_business: ["trend", "emotion", "suspense", "tutorial", "contrast", "authority", "pain"],
  brand_owner: ["emotion", "contrast", "authority", "suspense", "trend", "tutorial", "pain"],
  knowledge_blogger: ["authority", "tutorial", "pain", "suspense", "contrast", "emotion", "trend"],
  story_ip: ["emotion", "contrast", "suspense", "trend", "authority", "pain", "tutorial"]
};

const getSystemPrompt = (merchantType: string, duration: number) => {
  const preferredStyles = MERCHANT_STYLE_PREFERENCE[merchantType] || MERCHANT_STYLE_PREFERENCE.ecommerce;
  const styleOrder = preferredStyles.map((id, i) => `${i + 1}. ${TITLE_STYLES.find(s => s.id === id)?.name}`).join('\n');
  
  return `你是一位专业的短视频爆款标题策划专家，精通薛辉短视频架构方法论。

【核心任务】
基于用户提供的词根组合，生成3个完整的爆款选题方案。
每个选题方案需包含7种不同风格的标题变体（对应7种用户心理）。

【7种标题风格定义】
1. 悬念/好奇型：用问句或省略引发好奇心，情绪：好奇心
2. 权威/揭秘型：用"揭秘"、"我发现了"等建立信任感，情绪：求知欲
3. 从众/热点型：用"疯抢"、"全网"制造从众心理，情绪：从众心理
4. 冲突/反差型：用"千万别"、"竟然"制造意外感，情绪：意外感
5. 实用/教程型：用"一招"、"教你"提供具体价值，情绪：获得感
6. 痛点/避坑型：用"踩雷"、"后悔"直击焦虑，情绪：安全感
7. 情感/共鸣型：用"只有…才懂"引发共情，情绪：归属感

【商户类型风格优先级】
当前商户类型推荐风格排序：
${styleOrder}

【输出要求】
请生成3个选题方案，每个方案包含：
- 选题标题（综合7种风格的最佳标题）
- 冲突点（核心冲突描述）
- 情绪钩子（引发的情绪）
- 7种风格变体（每种风格一个标题变体，包含风格名称、标题、该风格的冲突点、该风格的情绪钩子）

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
    const { projectId, industry, wordRootCombination, merchantType, videoDuration, materials } = body;
    
    const merchantTypeKey = merchantType || "ecommerce";
    const duration = videoDuration || 30;

    if (!projectId || !industry || !wordRootCombination) {
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    // 构建素材分析信息（如果有）
    let materialsInfo = "";
    if (materials && materials.length > 0) {
      materialsInfo = `\n【用户上传素材】\n${materials.map((m: any, i: number) => 
        `${i + 1}. 类型：${m.type}${m.description ? `，描述：${m.description}` : ''}`
      ).join('\n')}\n选题和标题需要结合素材内容来设计。`;
    }

    const messages = [
      { role: "system" as const, content: getSystemPrompt(merchantTypeKey, duration) },
      {
        role: "user" as const,
        content: `【选题生成任务】

行业：${industry}
商户类型：${merchantTypeKey}
视频时长：${duration}秒

【词根组合】
${wordRootCombination.elements.map((e: string) => `- ${e}`).join('\n')}
词根说明：${wordRootCombination.description || '无'}
${materialsInfo}

请基于以上信息，生成3个完整的爆款选题方案，每个方案包含7种不同风格的标题变体。`,
      },
    ];

    const response = await client.invoke(messages, {
      model: "doubao-seed-1-8-251228",
      temperature: 0.9,
    });

    // 解析LLM返回的JSON
    let topicsData;
    try {
      const content = response.content;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                        content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      topicsData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("JSON解析错误:", parseError);
      topicsData = { topics: [] };
    }

    // 保存选题到数据库
    const supabaseClient = getSupabaseClient();
    
    if (topicsData.topics && topicsData.topics.length > 0) {
      const topicsToInsert = topicsData.topics.map((topic: any) => ({
        project_id: projectId,
        title: topic.title,
        conflict_point: topic.conflictPoint,
        emotion_hook: topic.emotionHook,
        is_selected: false,
      }));

      const { data: insertedTopics, error: insertError } = await supabaseClient
        .from("topics")
        .insert(topicsToInsert)
        .select();

      if (insertError) {
        console.error("保存选题失败:", insertError);
      }

      // 合并LLM返回的styleVariants到插入的数据中
      const topicsWithVariants = insertedTopics?.map((dbTopic: any, idx: number) => ({
        ...dbTopic,
        styleVariants: topicsData.topics[idx]?.styleVariants || []
      })) || topicsData.topics;

      return NextResponse.json({
        success: true,
        topics: topicsWithVariants,
        titleStyles: TITLE_STYLES
      });
    }

    return NextResponse.json({
      success: true,
      topics: [],
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
    const { projectId, industry, wordRootCombination, merchantType, videoDuration, materials } = body;
    
    const merchantTypeKey = merchantType || "ecommerce";
    const duration = videoDuration || 30;

    if (!projectId || !industry || !wordRootCombination) {
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    // 构建素材分析信息
    let materialsInfo = "";
    if (materials && materials.length > 0) {
      materialsInfo = `\n【用户上传素材】\n${materials.map((m: any, i: number) => 
        `${i + 1}. 类型：${m.type}${m.description ? `，描述：${m.description}` : ''}`
      ).join('\n')}`;
    }

    // 使用更高的temperature生成不同的选题
    const messages = [
      { role: "system" as const, content: getSystemPrompt(merchantTypeKey, duration) },
      {
        role: "user" as const,
        content: `【选题重新生成任务】请生成完全不同的选题

行业：${industry}
商户类型：${merchantTypeKey}
视频时长：${duration}秒

【词根组合】
${wordRootCombination.elements.map((e: string) => `- ${e}`).join('\n')}
${materialsInfo}

请生成3个完全不同的爆款选题方案（与之前的不同），每个方案包含7种不同风格的标题变体。`,
      },
    ];

    const response = await client.invoke(messages, {
      model: "doubao-seed-1-8-251228",
      temperature: 1.0,
    });

    // 解析并保存新选题
    let topicsData;
    try {
      const content = response.content;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                        content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      topicsData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("JSON解析错误:", parseError);
      topicsData = { topics: [] };
    }

    const supabaseClient = getSupabaseClient();
    
    if (topicsData.topics && topicsData.topics.length > 0) {
      const topicsToInsert = topicsData.topics.map((topic: any) => ({
        project_id: projectId,
        title: topic.title,
        conflict_point: topic.conflictPoint,
        emotion_hook: topic.emotionHook,
        is_selected: false,
      }));

      const { data: insertedTopics, error: insertError } = await supabaseClient
        .from("topics")
        .insert(topicsToInsert)
        .select();

      if (insertError) {
        console.error("保存选题失败:", insertError);
      }

      // 合并LLM返回的styleVariants到插入的数据中
      const topicsWithVariants = insertedTopics?.map((dbTopic: any, idx: number) => ({
        ...dbTopic,
        styleVariants: topicsData.topics[idx]?.styleVariants || []
      })) || topicsData.topics;

      return NextResponse.json({
        success: true,
        topics: topicsWithVariants,
        titleStyles: TITLE_STYLES
      });
    }

    return NextResponse.json({
      success: true,
      topics: [],
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
