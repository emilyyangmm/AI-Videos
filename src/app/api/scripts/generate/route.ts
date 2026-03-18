import { NextRequest, NextResponse } from "next/server";
import { LLMClient, Config, HeaderUtils } from "coze-coding-dev-sdk";
import { getSupabaseClient } from "@/storage/database/supabase-client";

const SYSTEM_PROMPT = `你是一位专业的短视频脚本创作专家，精通薛辉短视频架构方法论和Veo视频生成。

你需要根据用户提供的信息，生成完整的逐镜脚本。

脚本要求：
1. 包含开头3秒钩子、中间内容、结尾引导三大部分
2. 每个部分都要有详细的画面描述、口播文案
3. 生成的分镜要适合Veo视频生成，包含：场景、时间、主色调、镜号、秒数、画面描述、台词、音效

请以JSON格式返回，格式如下：
{
  "title": "脚本标题",
  "duration": 60,
  "persona": "人设定位描述",
  "conflict": "核心冲突",
  "emotionLine": "情绪主线",
  "openingHook": {
    "visual": "画面描述",
    "script": "口播文案",
    "bgm": "音乐风格"
  },
  "middleContent": [
    {
      "section": "段落1：抛出痛点/制造悬念",
      "visual": "画面描述",
      "script": "口播文案",
      "materialRef": "素材引用（如有）"
    },
    {
      "section": "段落2：揭示真相/展示反差",
      "visual": "画面描述",
      "script": "口播文案",
      "materialRef": "素材引用（如有）"
    },
    {
      "section": "段落3：提供解法/给出价值",
      "visual": "画面描述",
      "script": "口播文案",
      "materialRef": "素材引用（如有）"
    }
  ],
  "endingGuide": {
    "visual": "画面描述",
    "script": "行动号召文案",
    "cta": "具体引导动作"
  },
  "shotList": [
    {
      "scene": "场景名称",
      "location": "详细地点",
      "time": "时间",
      "colorTone": "主色调",
      "shots": [
        {
          "shotNumber": "S01",
          "duration": "5s",
          "visual": "谁+在哪+做什么动作+光线来向",
          "dialogue": "台词或无台词",
          "soundEffect": "具体音效"
        }
      ]
    }
  ]
}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, topic, wordRoots, materials } = body;

    if (!projectId || !topic) {
      return NextResponse.json(
        { error: "缺少必要参数：projectId 或 topic" },
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
        content: `选题：${topic.title}
冲突点：${topic.conflict_point}
情绪钩子：${topic.emotion_hook}
词根组合：${JSON.stringify(wordRoots)}
可用素材：${JSON.stringify(materials)}

请生成完整的逐镜脚本。`,
      },
    ];

    const response = await client.invoke(messages, {
      model: "doubao-seed-1-8-251228",
      temperature: 0.7,
    });

    // 解析LLM返回的JSON
    let scriptData;
    try {
      const content = response.content;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                        content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      scriptData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("JSON解析错误:", parseError);
      scriptData = { rawContent: response.content };
    }

    // 保存脚本到数据库
    const supabaseClient = getSupabaseClient();
    const { data: savedScript, error: saveError } = await supabaseClient
      .from("scripts")
      .insert({
        project_id: projectId,
        title: scriptData.title || topic.title,
        duration: scriptData.duration || 60,
        persona: scriptData.persona || "",
        conflict: scriptData.conflict || topic.conflict_point,
        emotion_line: scriptData.emotionLine || topic.emotion_hook,
        opening_hook: scriptData.openingHook || {},
        middle_content: scriptData.middleContent || [],
        ending_guide: scriptData.endingGuide || {},
        shot_list: scriptData.shotList || [],
      })
      .select()
      .single();

    if (saveError) {
      console.error("保存脚本失败:", saveError);
    }

    return NextResponse.json({
      success: true,
      script: savedScript || scriptData,
    });
  } catch (error) {
    console.error("脚本生成失败:", error);
    return NextResponse.json(
      { error: "脚本生成失败，请稍后重试" },
      { status: 500 }
    );
  }
}

// 获取项目的脚本
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "缺少参数：projectId" },
        { status: 400 }
      );
    }

    const supabaseClient = getSupabaseClient();
    const { data, error } = await supabaseClient
      .from("scripts")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      script: data,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "获取脚本失败" },
      { status: 500 }
    );
  }
}
