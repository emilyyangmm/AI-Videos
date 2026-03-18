import { NextRequest, NextResponse } from "next/server";
import { LLMClient, Config, HeaderUtils } from "coze-coding-dev-sdk";
import { getSupabaseClient } from "@/storage/database/supabase-client";

const SYSTEM_PROMPT = `你是一位专业的短视频爆款选题策划专家，精通薛辉短视频架构方法论。

你需要根据用户提供的行业和词根组合，生成3个爆款选题。

选题要求：
1. 每个选题都要包含具体的冲突点和情绪钩子
2. 题目要口语化、有吸引力、引发好奇
3. 覆盖不同角度（痛点型、揭秘型、对比型、故事型等）

请以JSON格式返回，格式如下：
{
  "topics": [
    {
      "title": "选题标题",
      "conflictPoint": "核心冲突点描述",
      "emotionHook": "引发的情绪描述",
      "type": "选题类型（痛点型/揭秘型/对比型/故事型）"
    }
  ]
}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, industry, wordRootCombination } = body;

    if (!projectId || !industry || !wordRootCombination) {
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: `行业：${industry}
词根组合：${JSON.stringify(wordRootCombination, null, 2)}

请生成3个爆款选题。`,
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
    const { projectId, industry, wordRootCombination } = body;

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
      { role: "system" as const, content: SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: `行业：${industry}
词根组合：${JSON.stringify(wordRootCombination, null, 2)}

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
