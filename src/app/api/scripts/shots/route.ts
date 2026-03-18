import { NextRequest, NextResponse } from "next/server";
import { LLMClient, Config, HeaderUtils } from "coze-coding-dev-sdk";
import { getSupabaseClient } from "@/storage/database/supabase-client";

/**
 * 分镜脚本生成API
 * 
 * 功能：
 * 1. 将30-60秒的脚本按8秒切片
 * 2. 为每个8秒片段生成完整的分镜脚本
 * 3. 输出格式符合Veo 3.1要求
 */

const SHOT_SCRIPT_PROMPT = `你是一位专业的短视频分镜脚本专家，精通将完整脚本拆分为精确的8秒分镜。

## 任务说明
用户会提供一个完整的短视频脚本（30-60秒），你需要：
1. 将脚本按8秒为一个片段进行拆分
2. 每个8秒片段需要包含完整的画面描述、动作、台词
3. 确保每个片段有明确的视觉焦点和情绪递进

## Veo 3.1 视频提示词要求
Veo生成视频需要以下要素：
- **主体**: 视频中的对象、人物、场景
- **动作**: 主体正在做的事情
- **风格**: 创意方向（如电影感、纪录片、卡通等）
- **相机位置与运动**: 航拍、平视、俯拍、轨道拍摄、仰拍等
- **构图**: 广角镜头、特写镜头、单人镜头、双人镜头等
- **对焦与镜头效果**: 浅景深、深景深、柔焦、微距镜头等
- **氛围**: 颜色和光线（如蓝色调、夜间、暖色调等）
- **音频提示**: 对话、音效、环境噪声

## 输出格式
请以JSON格式返回，格式如下：
{
  "totalDuration": 48,
  "shotCount": 6,
  "shots": [
    {
      "shotId": "S01",
      "startTime": "0:00",
      "endTime": "0:08",
      "duration": 8,
      "sceneTitle": "场景标题",
      "location": "具体地点",
      "timeOfDay": "时间（早晨/中午/傍晚/夜晚）",
      "colorTone": "主色调",
      "description": {
        "visual": "画面描述：谁+在哪+做什么动作+光线来向",
        "action": "具体动作描述",
        "emotion": "情绪基调"
      },
      "dialogue": {
        "chinese": "中文台词或旁白",
        "english": "英文翻译"
      },
      "audioPrompt": {
        "soundEffects": ["音效1", "音效2"],
        "backgroundMusic": "背景音乐风格",
        "ambientSound": "环境音"
      },
      "veoPrompt": {
        "chinese": "完整的中文视频描述提示词",
        "english": "Complete English video generation prompt for Veo 3.1"
      },
      "cameraWork": {
        "movement": "相机运动方式",
        "angle": "拍摄角度",
        "shot": "镜头类型"
      }
    }
  ]
}

## 重要规则
1. 每个片段严格8秒
2. 如果总时长不是8的倍数，最后一个片段可以是4-8秒
3. 每个片段必须有完整的视觉和听觉元素
4. veoPrompt.english 必须是完整的、专业的英文提示词
5. 确保分镜之间有连贯性和过渡
`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, script } = body;

    if (!projectId || !script) {
      return NextResponse.json(
        { error: "缺少必要参数：projectId 或 script" },
        { status: 400 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    // 构建用户输入
    const userInput = `
## 原始脚本信息

**标题**: ${script.title}
**总时长**: ${script.duration}秒
**人设定位**: ${script.persona}
**核心冲突**: ${script.conflict}
**情绪主线**: ${script.emotion_line}

## 开头钩子
${JSON.stringify(script.opening_hook, null, 2)}

## 中间内容
${JSON.stringify(script.middle_content, null, 2)}

## 结尾引导
${JSON.stringify(script.ending_guide, null, 2)}

请将以上脚本按8秒一个片段拆分为分镜脚本，每个分镜需要有完整的画面描述、台词和Veo提示词。
`;

    const messages = [
      { role: "system" as const, content: SHOT_SCRIPT_PROMPT },
      { role: "user" as const, content: userInput },
    ];

    const response = await client.invoke(messages, {
      model: "doubao-seed-1-8-251228",
      temperature: 0.7,
    });

    // 解析LLM返回的JSON
    let shotScript;
    try {
      const content = response.content;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                        content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      shotScript = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("JSON解析错误:", parseError);
      return NextResponse.json(
        { error: "分镜脚本解析失败", rawContent: response.content },
        { status: 500 }
      );
    }

    // 保存到数据库
    const supabaseClient = getSupabaseClient();
    const { error: updateError } = await supabaseClient
      .from("scripts")
      .update({
        shot_list: shotScript,
        updated_at: new Date().toISOString(),
      })
      .eq("id", script.id);

    if (updateError) {
      console.error("更新脚本失败:", updateError);
    }

    return NextResponse.json({
      success: true,
      shotScript,
      summary: {
        totalDuration: shotScript.totalDuration,
        shotCount: shotScript.shotCount,
        shots: shotScript.shots.map((s: any) => ({
          shotId: s.shotId,
          duration: s.duration,
          sceneTitle: s.sceneTitle,
          veoPromptPreview: s.veoPrompt.english?.slice(0, 100) + "...",
        })),
      },
    });
  } catch (error) {
    console.error("分镜脚本生成失败:", error);
    return NextResponse.json(
      { error: "分镜脚本生成失败" },
      { status: 500 }
    );
  }
}

// 获取项目的分镜脚本
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

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      script: data,
      shotList: data?.shot_list || null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "获取分镜脚本失败" },
      { status: 500 }
    );
  }
}
