import { NextRequest, NextResponse } from "next/server";
import { LLMClient, Config, HeaderUtils } from "coze-coding-dev-sdk";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// 场景配置
const SCENARIO_CONFIG: Record<string, { focus: string; style: string; tips: string[] }> = {
  ecommerce: {
    focus: "产品卖点、痛点解决方案、前后对比效果",
    style: "快节奏、直击痛点、强转化导向",
    tips: ["前3秒必须抓住眼球", "突出痛点与解决方案", "展示前后对比效果"]
  },
  local_business: {
    focus: "瞬间吸引力、环境氛围、优惠活动",
    style: "生活化、真实感、引流导向",
    tips: ["展示最吸引人的瞬间", "突出环境氛围", "展示优惠活动"]
  },
  brand_story: {
    focus: "情感共鸣、人设建立、故事转折",
    style: "剧情化、情感丰富、深度内容",
    tips: ["3秒钩子抓住观众", "设置转折点", "结尾反转或情感升华"]
  },
  tutorial: {
    focus: "实用技巧、清晰步骤、知识点输出",
    style: "专业、易懂、干货导向",
    tips: ["步骤清晰易懂", "每步控制在8秒内", "突出关键操作点"]
  }
};

const getSystemPrompt = (scenario: string, duration: number) => {
  const config = SCENARIO_CONFIG[scenario] || SCENARIO_CONFIG.ecommerce;
  
  return `你是一位专业的短视频爆款选题策划专家，精通薛辉短视频架构方法论。

你需要根据用户提供的行业、词根组合、使用场景和视频时长，生成3个爆款选题。

当前场景特点：
- 使用场景：${scenario}
- 核心聚焦：${config.focus}
- 内容风格：${config.style}
- 视频时长：${duration}秒

选题要求：
1. 每个选题都要包含具体的冲突点和情绪钩子
2. 题目要口语化、有吸引力、引发好奇
3. 覆盖不同角度（痛点型、揭秘型、对比型、故事型等）
4. 时长${duration <= 30 ? '较短，选题要更直接、更有冲击力，减少铺垫' : '适中，可以包含更多故事性元素和情感铺垫'}
5. 符合${scenario}场景的特点：${config.tips.join('、')}

请以JSON格式返回，格式如下：
{
  "topics": [
    {
      "title": "选题标题",
      "conflictPoint": "核心冲突点描述",
      "emotionHook": "引发的情绪描述",
      "type": "选题类型（痛点型/揭秘型/对比型/故事型）",
      "durationAdvice": "针对${duration}秒时长的内容建议"
    }
  ]
}`;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, industry, wordRootCombination, scenario, videoDuration } = body;
    
    // 获取场景配置
    const scenarioType = scenario || "ecommerce";
    const duration = videoDuration || 30;
    const config = SCENARIO_CONFIG[scenarioType] || SCENARIO_CONFIG.ecommerce;

    if (!projectId || !industry || !wordRootCombination) {
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config2 = new Config();
    const client = new LLMClient(config2, customHeaders);

    const messages = [
      { role: "system" as const, content: getSystemPrompt(scenarioType, duration) },
      {
        role: "user" as const,
        content: `行业：${industry}
词根组合：${JSON.stringify(wordRootCombination, null, 2)}
使用场景：${scenarioType}（${config.focus}）
视频时长：${duration}秒

请根据以上信息，生成3个最适合该场景和时长的爆款选题。`,
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

      return NextResponse.json({
        success: true,
        topics: insertedTopics || topicsData.topics,
      });
    }

    return NextResponse.json({
      success: true,
      topics: [],
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
    const { projectId, industry, wordRootCombination, scenario, videoDuration } = body;
    
    const scenarioType = scenario || "ecommerce";
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

    // 使用更高的temperature生成不同的选题
    const messages = [
      { role: "system" as const, content: getSystemPrompt(scenarioType, duration) },
      {
        role: "user" as const,
        content: `行业：${industry}
词根组合：${JSON.stringify(wordRootCombination, null, 2)}
使用场景：${scenarioType}
视频时长：${duration}秒

请生成3个完全不同的爆款选题（与之前的不同）。`,
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

      return NextResponse.json({
        success: true,
        topics: insertedTopics || topicsData.topics,
      });
    }

    return NextResponse.json({
      success: true,
      topics: [],
    });
  } catch (error) {
    console.error("重新生成选题失败:", error);
    return NextResponse.json(
      { error: "重新生成选题失败，请稍后重试" },
      { status: 500 }
    );
  }
}
