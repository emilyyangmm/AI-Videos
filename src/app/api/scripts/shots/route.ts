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

## 【核心任务】根据脚本实际内容动态拆分分镜

### ⚠️ 硬性限制：时长只能是 4/6/8 秒
Veo只支持这三种时长规格，**严禁使用其他时长（如5秒、7秒）**！

### 动态拆分规则（根据脚本实际情况决定）

**输入：**
- 用户脚本的总时长（可能是15/30/60/90秒等任意值）
- middle_content的实际段落数量（可能是1段、3段、5段等）

**拆分原则：**

1. **开头钩子**：固定4秒
   - 这是黄金开场，永远4秒

2. **中间内容**：根据实际情况动态拆分
   - **首先**：看middle_content有几段内容
   - **其次**：计算剩余时长 = 总时长 - 4(开头) - 4~6(结尾)
   - **然后**：根据段落数量和剩余时长，决定拆成几个分镜
   - **每个分镜时长**：只能是4/6/8秒
   
   例如：
   - 如果middle_content有1段，剩余时长7秒 → 1个6秒或8秒分镜
   - 如果middle_content有3段，剩余时长20秒 → 3个分镜（如6+6+8=20秒）
   - 如果middle_content有5段，剩余时长50秒 → 6-7个分镜

3. **结尾引导**：4秒或6秒
   - 根据剩余时长选择合适的结尾时长

### 关键：不要套用固定模板！

**❌ 错误做法：** 
- 不管脚本多少段落，都拆成3个分镜
- 不管总时长多少，都套用固定时长

**✅ 正确做法：**
- 先看脚本总时长 → 决定需要几个分镜
- 再看middle_content段落数 → 决定中间几个分镜
- 最后根据剩余时长 → 分配每个分镜的具体时长

### 示例（仅供参考逻辑，不要照抄数值）

**逻辑示例A：15秒脚本，middle_content有1段**
- 计算剩余：15 - 4(开头) - 4(结尾) = 7秒
- 中间1段内容，7秒 → 用1个6秒或8秒分镜
- 结果：开头4秒 + 中间6秒 + 结尾4秒 = 14秒

**逻辑示例B：30秒脚本，middle_content有2段**
- 计算剩余：30 - 4(开头) - 4(结尾) = 22秒
- 中间2段内容，22秒 → 可能需要3-4个分镜
- 结果：开头4秒 + 中间(6+8+8=22秒，3个分镜) + 结尾4秒 = 30秒

**逻辑示例C：60秒脚本，middle_content有4段**
- 计算剩余：60 - 4(开头) - 6(结尾) = 50秒
- 中间4段内容，50秒 → 可能需要6-7个分镜
- 结果：开头4秒 + 中间(8×6=48秒，6个分镜) + 结尾6秒 = 58秒

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

## 输出格式（精简版，避免JSON过长）

\`\`\`json
{
  "totalDuration": 14,
  "shotCount": 3,
  "shots": [
    {
      "shotId": "S01",
      "scriptSection": "opening_hook",
      "duration": 4,
      "sceneTitle": "钩子展示",
      "visual": "画面描述",
      "dialogue": "台词",
      "veoPrompt": {
        "chinese": "中文提示词",
        "english": "English prompt with all 8 elements"
      },
      "materialNeeds": [
        {"type": "素材类型", "description": "具体描述", "required": true}
      ]
    }
  ]
}
\`\`\`

**注意**：
- veoPrompt.english 必须包含8大要素：主体、动作、风格、相机、构图、镜头效果、氛围、音频
- 每个分镜只保留必要字段，避免JSON过长

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
    // 兼容驼峰和下划线两种格式的字段名
    const openingHook = script.opening_hook || script.openingHook || {};
    const middleContent = script.middle_content || script.middleContent || [];
    const endingGuide = script.ending_guide || script.endingGuide || {};
    const middleContentCount = Array.isArray(middleContent) ? middleContent.length : 0;
    
    const userInput = `
## 原始脚本信息

**标题**: ${script.title}
**总时长**: ${script.duration}秒
**人设定位**: ${script.persona}

---

## 【三段式结构】

### 一、开头钩子（opening_hook）- 1段
${JSON.stringify(openingHook, null, 2)}

### 二、中间内容（middle_content）- ${middleContentCount}段
${JSON.stringify(middleContent, null, 2)}

### 三、结尾引导（ending_guide）- 1段
${JSON.stringify(endingGuide, null, 2)}

---

## 【动态拆分要求】

**当前脚本情况：**
- 总时长：${script.duration}秒
- 开头钩子：1段 → 固定4秒
- 中间内容：${middleContentCount}段 → 需要根据段落数和剩余时长动态拆分
- 结尾引导：1段 → 4秒或6秒

**拆分步骤：**
1. 开头固定4秒
2. 计算中间剩余时长 = ${script.duration} - 4(开头) - 4~6(结尾) = ${script.duration - 10}~${script.duration - 8}秒
3. 根据中间内容${middleContentCount}段 + 剩余时长，决定拆成几个分镜
4. 每个分镜时长只能是4/6/8秒

**⚠️ 硬性约束**：
- **每个分镜时长只能是 4、6 或 8 秒**（Veo限制，严禁其他时长）
- **不要套固定模板**，根据实际时长和段落数动态决定分镜数量
- 时长总和尽量接近${script.duration}秒（误差≤2秒）
- 每个分镜的素材需求必须根据具体内容生成
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
      console.log("[DEBUG] LLM返回内容长度:", content.length);
      
      // 方法1：尝试匹配 ```json 代码块
      let jsonStr = "";
      const jsonBlockStart = content.indexOf("```json");
      if (jsonBlockStart !== -1) {
        const jsonStart = content.indexOf("{", jsonBlockStart);
        const jsonEnd = content.lastIndexOf("}");
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          jsonStr = content.slice(jsonStart, jsonEnd + 1);
        }
      }
      
      // 方法2：如果没有代码块，直接找JSON对象
      if (!jsonStr) {
        const startIndex = content.indexOf('{');
        const lastIndex = content.lastIndexOf('}');
        if (startIndex !== -1 && lastIndex !== -1 && lastIndex > startIndex) {
          jsonStr = content.slice(startIndex, lastIndex + 1);
        }
      }
      
      if (!jsonStr) {
        throw new Error("未找到有效的JSON内容");
      }
      
      console.log("[DEBUG] 提取的JSON长度:", jsonStr.length);
      shotScript = JSON.parse(jsonStr);
      
      // 验证必要字段
      if (!shotScript.shots || !Array.isArray(shotScript.shots)) {
        throw new Error("返回数据缺少shots数组");
      }
      
    } catch (parseError) {
      console.error("[ERROR] JSON解析错误:", parseError);
      return NextResponse.json(
        { error: "分镜脚本解析失败: " + (parseError instanceof Error ? parseError.message : String(parseError)), rawContent: responseText.slice(0, 2000) },
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
