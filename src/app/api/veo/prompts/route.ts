import { NextRequest, NextResponse } from "next/server";
import { callGemini, buildChatPrompt } from "@/lib/gemini";

/**
 * Veo 3.1 提示词优化API
 * 
 * 功能：
 * 1. 将分镜脚本转换为符合Veo 3.1要求的英文提示词
 * 2. 包含所有8个核心要素
 * 3. 支持音频提示
 */

const VEO_PROMPT_OPTIMIZER = `你是一位专业的Veo 3.1视频生成提示词专家。

## Veo 3.1 高质量提示词要素（按重要性排序）

1. **主体 (Subject)**: 视频中的对象、人物、动物或场景
   - 例：A young woman in business attire, A golden retriever puppy, A futuristic cityscape

2. **动作 (Action)**: 主体正在做的事情
   - 例：walking confidently, chasing a butterfly, flying through clouds

3. **风格 (Style)**: 创意方向
   - 关键词：cinematic, documentary, horror, sci-fi, cartoon, anime, film noir

4. **相机位置与运动 (Camera Position & Movement)**:
   - 位置：aerial view, eye level, low angle, high angle, bird's eye view
   - 运动：tracking shot, dolly shot, crane shot, handheld, static shot, pan, tilt, zoom

5. **构图 (Composition)**:
   - 关键词：wide shot, medium shot, close-up, extreme close-up, single shot, two shot, over-the-shoulder shot

6. **对焦与镜头效果 (Focus & Lens Effects)**:
   - 关键词：shallow depth of field, deep focus, soft focus, macro lens, wide angle lens, fisheye lens

7. **氛围 (Atmosphere)**:
   - 光线：natural lighting, golden hour, blue hour, dramatic lighting, soft diffused light
   - 颜色：warm tones, cool tones, muted colors, vibrant colors, monochrome

8. **音频提示 (Audio Prompt)**:
   - 对话：用引号包裹
   - 音效：明确描述
   - 环境音：描述背景声音

## 提示词长度限制
- 最多1024个token
- 建议英文提示词长度：150-300词

## ⚠️ 必须包含中国元素（强制要求）
每个英文提示词**必须**在末尾加上以下内容，确保生成中国风格的画面：

1. **人物描述**：
   - 中国人物：Chinese people, Asian appearance, East Asian facial features
   - 女性：Chinese woman with East Asian facial features
   - 男性：Chinese man with East Asian facial features

2. **场景描述**：
   - 室内场景：Chinese store interior, Chinese restaurant interior, Chinese style interior
   - 室外场景：Chinese urban environment, Chinese street scene, China city setting
   - 通用结尾：Chinese style, China setting

3. **示例**：
   - 原始：A woman walking in a store
   - 修改后：A Chinese woman with East Asian facial features walking in a Chinese store interior, Chinese style, China setting

## 否定提示规范
- 不要使用"不"或"不要"等指令性语言
- 直接描述想要看到的内容

## 输出格式
请以JSON格式返回：
{
  "optimizedPrompts": {
    "chinese": "优化后的中文提示词（完整描述）",
    "english": "Optimized English prompt for Veo 3.1 video generation"
  },
  "audioPrompt": {
    "chinese": "中文音频提示",
    "english": "English audio prompt with dialogue in quotes and sound effects described"
  },
  "parameters": {
    "aspectRatio": "16:9 或 9:16 或 1:1",
    "duration": 8,
    "generateAudio": true
  }
}

## 示例

输入：
"一个年轻女性在办公室里打字，阳光从窗户照进来"

输出：
{
  "optimizedPrompts": {
    "chinese": "一位身着白色职业装的年轻女性坐在现代办公室的办公桌前，阳光透过落地窗从左侧洒入，形成温暖的光晕。她专注地敲击着键盘，偶尔抬手整理耳边的发丝。镜头采用中景构图，浅景深效果使背景虚化，营造专业而温馨的氛围。",
    "english": "A young professional woman in a white blouse sits at a modern office desk, typing on a keyboard with focused concentration. Natural sunlight streams through floor-to-ceiling windows from the left, creating a warm golden halo effect. Medium shot composition with shallow depth of field, soft bokeh background. She occasionally tucks a strand of hair behind her ear. Professional and cozy atmosphere with warm color tones."
  },
  "audioPrompt": {
    "chinese": "键盘敲击声，办公室环境音，轻柔的背景音乐",
    "english": "Keyboard typing sounds, office ambient noise, soft background music, no dialogue"
  },
  "parameters": {
    "aspectRatio": "16:9",
    "duration": 8,
    "generateAudio": true
  }
}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shots, aspectRatio = "16:9" } = body;

    if (!shots || !Array.isArray(shots)) {
      return NextResponse.json(
        { error: "缺少必要参数：shots数组" },
        { status: 400 }
      );
    }

    const optimizedShots = [];

    for (const shot of shots) {
      // 如果已经有veoPrompt，跳过或仅优化
      const inputPrompt = shot.veoPrompt?.chinese || 
                         shot.description?.visual || 
                         JSON.stringify(shot);

      const userPrompt = `请为以下分镜生成优化的Veo 3.1提示词：

分镜信息：
- 场景：${shot.sceneTitle || shot.location || "未知"}
- 时长：${shot.duration || 8}秒
- 画面描述：${shot.description?.visual || inputPrompt}
- 动作：${shot.description?.action || ""}
- 情绪：${shot.description?.emotion || ""}
- 台词（中文）：${shot.dialogue?.chinese || "无"}
- 相机运动：${shot.cameraWork?.movement || ""} ${shot.cameraWork?.angle || ""} ${shot.cameraWork?.shot || ""}

请生成完整的Veo 3.1提示词。`;

      // 调用Gemini
      const responseText = await callGemini(
        buildChatPrompt(VEO_PROMPT_OPTIMIZER, userPrompt)
      );

      try {
        const content = responseText;
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                          content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
        const optimized = JSON.parse(jsonStr);

        optimizedShots.push({
          ...shot,
          veoPrompt: optimized.optimizedPrompts,
          audioPrompt: optimized.audioPrompt,
          parameters: {
            ...optimized.parameters,
            aspectRatio,
          },
        });
      } catch (parseError) {
        console.error("解析优化结果失败:", parseError);
        // 使用原始数据
        optimizedShots.push({
          ...shot,
          veoPrompt: {
            chinese: shot.veoPrompt?.chinese || inputPrompt,
            english: responseText,
          },
          parameters: {
            aspectRatio,
            duration: shot.duration || 8,
            generateAudio: true,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      shotCount: optimizedShots.length,
      shots: optimizedShots,
      veoReady: true,
      message: "提示词已优化，可直接提交给Veo API",
    });
  } catch (error) {
    console.error("Veo提示词优化失败:", error);
    return NextResponse.json(
      { error: "Veo提示词优化失败" },
      { status: 500 }
    );
  }
}
