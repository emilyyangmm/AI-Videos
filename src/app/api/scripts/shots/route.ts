import { NextRequest, NextResponse } from "next/server";
import { callLLM, HeaderUtils } from "@/lib/llm";
// import { getSupabaseClient } from "@/storage/database/supabase-client";

/**
 * 分镜脚本生成API
 * 
 * 功能：
 * 1. 将30-60秒的脚本按8秒切片
 * 2. 为每个8秒片段生成完整的分镜脚本
 * 3. 输出格式符合Veo 3.1要求
 */

const SHOT_SCRIPT_PROMPT = `你是一位专业的短视频分镜脚本专家，精通将完整脚本拆分为精确的8秒分镜，并能为每个分镜生成符合Veo 3.1要求的高质量视频提示词。

## 任务说明
用户会提供一个完整的短视频脚本（30-60秒），你需要：
1. 将脚本按8秒为一个片段进行拆分
2. 每个8秒片段需要包含完整的画面描述、动作、台词
3. 确保每个片段有明确的视觉焦点和情绪递进
4. 为每个分镜生成符合Veo 3.1要求的英文提示词

## Veo 3.1 视频提示词8大核心要素（必须包含）
每个分镜的英文提示词（veoPrompt.english）必须包含以下要素：

1. **主体 (Subject)**: 视频中的对象、人物、动物或场景
   - 示例: A young woman with curly hair, A golden retriever, A modern kitchen

2. **动作 (Action)**: 主体正在做的事情
   - 示例: walking confidently, mixing ingredients, looking at camera and smiling

3. **风格 (Style)**: 创意方向关键词
   - 示例: cinematic, documentary style, vibrant colors, high contrast

4. **相机位置与运动 (Camera Movement)**: 
   - 相机位置: aerial view, eye level, low angle, high angle
   - 相机运动: static shot, tracking shot, pan left/right, zoom in/out, dolly shot

5. **构图 (Composition)**:
   - 镜头类型: wide shot, medium shot, close-up, extreme close-up
   - 构图方式: single shot, two shot, over-the-shoulder shot

6. **对焦与镜头效果 (Lens Effects)**:
   - 景深: shallow depth of field, deep focus
   - 效果: soft focus, sharp focus, macro lens, wide angle lens

7. **氛围 (Atmosphere)**:
   - 光线: natural lighting, golden hour, soft diffused light, dramatic shadows
   - 色调: warm tones, cool tones, vibrant colors, muted palette
   - 时间: morning, afternoon, sunset, night

8. **音频提示 (Audio)**: 对话、音效、环境噪声（可选）
   - 对话使用引号: "Welcome to my channel!"
   - 音效描述: gentle background music, city ambiance, nature sounds

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
        "chinese": "完整的中文视频描述提示词，包含所有要素",
        "english": "Complete English video generation prompt that MUST include all 8 elements: subject, action, style, camera movement, composition, lens effects, atmosphere, and optionally audio. Should be detailed and specific, around 100-150 words."
      },
      "cameraWork": {
        "movement": "相机运动方式",
        "angle": "拍摄角度",
        "shot": "镜头类型"
      },
      "style": "风格关键词",
      "lens": "镜头效果",
      "atmosphere": {
        "time": "时间",
        "color": "色调",
        "lighting": "光线"
      }
    }
  ]
}

## 英文提示词撰写规范
每个分镜的 veoPrompt.english 必须遵循以下结构：
1. 开头：主体 + 正在做的动作（最关键信息）
2. 中间：环境、光线、氛围描述
3. 相机：相机位置、运动、镜头类型
4. 效果：景深、焦点、特殊效果
5. 风格：整体风格关键词
6. 音频：如有对话或音效，最后说明

示例：
"A female beauty store owner in her 30s, wearing professional makeup, stands behind the counter of her modern cosmetic shop. She gestures elegantly while speaking to camera, natural light streams through large windows creating soft shadows. The camera uses a medium shot at eye level with a slow push-in movement. Shallow depth of field keeps focus on her face while the product shelves in background are slightly blurred. Cinematic style with warm, inviting color palette. Soft background music plays. She says 'Welcome to my shop' with a genuine smile."

## 重要规则
1. 每个片段严格8秒
2. 如果总时长不是8的倍数，最后一个片段可以是4-8秒
3. 每个片段必须有完整的视觉和听觉元素
4. veoPrompt.english 必须是完整的、专业的英文提示词，包含所有8大要素
5. veoPrompt.chinese 必须是完整的中文描述，与英文版本对应
6. 确保分镜之间有连贯性和过渡
7. 英文提示词长度控制在100-150词之间
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

    // 提取请求头
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    
    // 调用LLM
    const responseText = await callLLM(
      SHOT_SCRIPT_PROMPT,
      userInput,
      customHeaders,
      { temperature: 0.7 }
    );

    // 解析LLM返回的JSON
    let shotScript;
    try {
      const content = responseText;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                        content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      shotScript = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("JSON解析错误:", parseError);
      return NextResponse.json(
        { error: "分镜脚本解析失败", rawContent: responseText },
        { status: 500 }
      );
    }

    // 保存到数据库 - 已注释掉 Supabase
    // const supabaseClient = getSupabaseClient();
    // const { error: updateError } = await supabaseClient
    //   .from("scripts")
    //   .update({
    //     shot_list: shotScript,
    //     updated_at: new Date().toISOString(),
    //   })
    //   .eq("id", script.id);
    // if (updateError) {
    //   console.error("更新脚本失败:", updateError);
    // }
    console.log("[DB] 更新脚本分镜:", { scriptId: script.id, shotCount: shotScript.shots?.length });

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

    // const supabaseClient = getSupabaseClient();
    // const { data, error } = await supabaseClient
    //   .from("scripts")
    //   .select("*")
    //   .eq("project_id", projectId)
    //   .order("created_at", { ascending: false })
    //   .limit(1)
    //   .single();
    // if (error) {
    //   return NextResponse.json({ error: error.message }, { status: 500 });
    // }
    // return NextResponse.json({
    //   success: true,
    //   script: data,
    //   shotList: data?.shot_list || null,
    // });
    console.log("[DB] 获取分镜脚本:", { projectId });
    return NextResponse.json({
      success: true,
      script: null,
      shotList: null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "获取分镜脚本失败" },
      { status: 500 }
    );
  }
}
