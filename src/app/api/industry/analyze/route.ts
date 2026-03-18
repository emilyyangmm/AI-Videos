import { NextRequest, NextResponse } from "next/server";
import { LLMClient, Config, HeaderUtils } from "coze-coding-dev-sdk";
import { getSupabaseClient } from "@/storage/database/supabase-client";

const SYSTEM_PROMPT = `你是一位专业的短视频内容策略专家，精通薛辉短视频架构方法论。

你的任务是分析用户输入的行业/赛道，并提供：
1. 目标人群特征分析（年龄、性别、地域、职业、痛点、需求）
2. 推荐的变现方式（至少3种）
3. 适合该行业的爆款元素组合方向

请以JSON格式返回，格式如下：
{
  "targetAudience": {
    "age": "年龄范围",
    "gender": "性别分布",
    "location": "地域分布",
    "occupation": "职业特征",
    "painPoints": ["痛点1", "痛点2", "痛点3"],
    "needs": ["需求1", "需求2", "需求3"]
  },
  "monetizationMethods": [
    {"method": "变现方式", "description": "具体说明"}
  ],
  "recommendedElements": {
    "primary": ["主要推荐的爆款元素"],
    "secondary": ["次要推荐的爆款元素"]
  }
}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, industry } = body;

    if (!projectId || !industry) {
      return NextResponse.json(
        { error: "缺少必要参数：projectId 或 industry" },
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
        content: `请分析以下行业/赛道：${industry}`,
      },
    ];

    const response = await client.invoke(messages, {
      model: "doubao-seed-1-8-251228",
      temperature: 0.7,
    });

    // 解析LLM返回的JSON
    let analysisResult;
    try {
      // 提取JSON部分（可能包含markdown代码块）
      const content = response.content;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                        content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      analysisResult = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("JSON解析错误:", parseError);
      analysisResult = { rawContent: response.content };
    }

    // 更新项目记录
    const supabaseClient = getSupabaseClient();
    const { error: updateError } = await supabaseClient
      .from("projects")
      .update({
        industry_analysis: analysisResult,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    if (updateError) {
      console.error("更新项目失败:", updateError);
    }

    return NextResponse.json({
      success: true,
      analysis: analysisResult,
    });
  } catch (error) {
    console.error("赛道分析失败:", error);
    return NextResponse.json(
      { error: "赛道分析失败，请稍后重试" },
      { status: 500 }
    );
  }
}
