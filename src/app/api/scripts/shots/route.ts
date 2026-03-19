import { NextRequest, NextResponse } from "next/server";
import { callLLM, HeaderUtils } from "@/lib/llm";
// import { getSupabaseClient } from "@/storage/database/supabase-client";

/**
 * 分镜脚本生成API
 * 
 * 核心逻辑：
 * 1. 根据脚本的三段式结构（开头钩子 + 中间内容 + 结尾引导）智能拆分
 * 2. ⚠️ 时长只能是 4/6/8 秒（Veo限制）
 * 3. 开头钩子固定4秒（抓住眼球）
 * 4. 中间内容根据实际内容拆分为4/6/8秒片段
 * 5. 结尾引导4秒或6秒（行动号召）
 * 6. 每个分镜根据内容生成具体的素材需求提示
 */

const SHOT_SCRIPT_PROMPT = `你是一位专业的短视频分镜脚本专家，精通将完整脚本拆分为精确的分镜片段，并能为每个分镜生成符合Veo要求的视频提示词。

## 【核心任务】根据脚本三段式结构智能拆分分镜

### ⚠️ 最重要的规则：时长只能是 4/6/8 秒
Veo只支持这三种时长规格，**严禁使用其他时长（如5秒、7秒）**！

### 输入结构分析
用户会提供一个完整脚本，包含：
- opening_hook（开头钩子）：抓住眼球
- middle_content（中间内容）：主体内容
- ending_guide（结尾引导）：行动号召

### 时长拆分规则（严格执行）

**Veo支持的时长规格：只有 4秒、6秒、8秒 三种**

拆分逻辑：
1. **开头钩子**：固定4秒（黄金开场）

2. **中间内容**：只能是4/6/8秒
   - 根据剩余时长合理分配
   - 可以拆分为多个分镜

3. **结尾引导**：只能是4秒或6秒

### 拆分时长计算示例

**15秒脚本拆分：**
- 开头：4秒
- 中间：6秒（一个分镜）
- 结尾：4秒
- 总计：4+6+4 = 14秒（略短于15秒，但符合Veo规格）
- 或：开头4秒 + 中间8秒 + 结尾4秒 = 16秒（略长于15秒）

**30秒脚本拆分：**
- 开头：4秒
- 中间：8秒 + 8秒 + 6秒 = 22秒（三个分镜）
- 结尾：4秒
- 总计：4+8+8+6+4 = 30秒 ✅

**60秒脚本拆分：**
- 开头：4秒
- 中间：8秒 × 6 = 48秒（六个分镜）
- 结尾：8秒
- 总计：4+48+8 = 60秒 ✅

### 核心原则
1. **每个分镜时长必须是 4、6 或 8 秒**（其他时长无效）
2. 总时长尽量接近脚本时长（误差不超过2秒）
3. 优先保证内容完整，其次考虑时长精确

## 【素材需求生成规则】

每个分镜必须根据其**具体内容**生成素材需求，**严禁使用固定模板**！

### 素材需求分析逻辑
根据分镜内容提取关键元素：
- 有人物出镜 → 需要人物素材（描述具体动作：比如"探店达人展示甜品"）
- 有产品展示 → 需要产品素材（描述具体产品：比如"慕斯蛋糕、冰美式"）
- 有环境场景 → 需要环境素材（描述具体场景：比如"甜品店内景"、"店铺门头"）
- 有文字信息 → 需要文字素材（描述具体内容：比如"价格标签9.9元"、"店铺名称"）

### 素材需求格式
\`\`\`json
{
  "materialNeeds": [
    {
      "type": "人物素材",
      "description": "探店达人展示慕斯蛋糕和冰美式，热情的表情动作",
      "suggestedDuration": "与分镜时长一致",
      "required": true
    },
    {
      "type": "产品素材",
      "description": "高颜值慕斯蛋糕特写、冰美式咖啡",
      "suggestedDuration": "2-3秒特写",
      "required": false
    }
  ]
}
\`\`\`

## Veo 3.1 视频提示词8大核心要素（必须包含）

每个分镜的英文提示词必须包含以下要素：

1. **主体 (Subject)**: 视频中的对象、人物、动物或场景
2. **动作 (Action)**: 主体正在做的事情
3. **风格 (Style)**: 创意方向关键词
4. **相机位置与运动 (Camera Movement)**: 相机位置和运动方式
5. **构图 (Composition)**: 镜头类型和构图方式
6. **对焦与镜头效果 (Lens Effects)**: 景深、焦点效果
7. **氛围 (Atmosphere)**: 光线、色调、时间
8. **音频提示 (Audio)**: 对话、音效、环境噪声

## 输出格式

\`\`\`json
{
  "totalDuration": 14,
  "shotCount": 3,
  "scriptStructure": {
    "openingDuration": 4,
    "middleDuration": 6,
    "endingDuration": 4
  },
  "shots": [
    {
      "shotId": "S01",
      "scriptSection": "opening_hook",
      "startTime": "0:00",
      "endTime": "0:04",
      "duration": 4,
      "sceneTitle": "9.9元下午茶钩子展示",
      "description": {
        "visual": "堆满高颜值甜品、咖啡的托盘怼脸展示，镜头快速拉近",
        "action": "镜头快速推向托盘，展示丰富甜品",
        "emotion": "惊喜、吸引"
      },
      "dialogue": {
        "chinese": "家人们！职场人专属9.9元下午茶来了！",
        "english": "Guys! The exclusive 9.9 yuan afternoon tea for office workers is here!"
      },
      "audioPrompt": {
        "soundEffects": ["轻快BGM渐入"],
        "backgroundMusic": "职场解压电子音乐"
      },
      "veoPrompt": {
        "chinese": "堆满高颜值慕斯蛋糕、冰美式的托盘，镜头快速推近，阳光从侧方打在食物上，营造诱人氛围。相机：怼脸特写快速推近。风格：活泼种草风。",
        "english": "A tray piled with high-value mousse cake and iced Americano. Action: Camera quickly zooms in on the tray. Style: lively grass-planting style. Camera movement: extreme close-up with fast zoom in. Composition: food extreme close-up. Lens effects: sharp focus. Atmosphere: natural side lighting, warm tones, afternoon. Audio: upbeat background music starts."
      },
      "cameraWork": {
        "movement": "快速推近",
        "angle": "平视",
        "shot": "极端特写"
      },
      "materialNeeds": [
        {
          "type": "产品素材",
          "description": "高颜值慕斯蛋糕、冰美式咖啡托盘，侧光打在食物上",
          "required": true
        },
        {
          "type": "环境素材",
          "description": "甜品店温馨环境背景（虚化）",
          "required": false
        }
      ]
    }
  ]
}
\`\`\`

## 重要规则
1. **严格按脚本三段式结构拆分**：开头(4秒) + 中间(4/6/8秒) + 结尾(4秒或6秒)
2. **⚠️ 时长必须符合Veo规格**：每个分镜时长只能是4、6或8秒，**严禁使用其他时长**
3. **素材需求必须根据内容生成**：严禁使用固定模板，必须分析每个分镜的具体内容
4. **分镜之间要有连贯性**：情绪递进、视觉过渡自然
5. **英文提示词要完整**：包含所有8大要素，100-150词
6. **总时长控制**：所有分镜时长之和应接近脚本总时长（误差不超过2秒）
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

---

## 【三段式结构】

### 一、开头钩子（opening_hook）
${JSON.stringify(script.opening_hook, null, 2)}

### 二、中间内容（middle_content）
${JSON.stringify(script.middle_content, null, 2)}

### 三、结尾引导（ending_guide）
${JSON.stringify(script.ending_guide, null, 2)}

---

## 【拆分要求】

请根据以上脚本的三段式结构，按照以下规则拆分分镜：

1. **开头钩子**：固定4秒，抓住眼球
2. **中间内容**：根据实际段落数量和内容拆分为4/6/8秒的片段
3. **结尾引导**：4秒或6秒，行动号召

**⚠️ 重要约束**：
- **每个分镜时长只能是 4、6 或 8 秒**（Veo硬性限制，严禁使用其他时长如5秒、7秒）
- 时长总和应接近${script.duration}秒
- 每个分镜必须根据具体内容生成素材需求（不要用固定模板）
- 确保分镜之间有连贯性和情绪递进
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
