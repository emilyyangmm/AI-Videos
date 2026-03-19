import { NextRequest, NextResponse } from "next/server";
import { callLLM, HeaderUtils } from "@/lib/llm";
// import { getSupabaseClient } from "@/storage/database/supabase-client";

// 商户类型配置
const MERCHANT_TYPE_CONFIG: Record<string, { 
  style: string; 
  tone: string;
  persona: string;
  keyPoints: string[];
}> = {
  ecommerce: {
    style: "快节奏、直击痛点、强转化导向",
    tone: "口语化、有冲击力、紧迫感",
    persona: "懂产品的销售专家/省钱达人",
    keyPoints: ["前3秒必须抓住眼球", "突出痛点与解决方案", "展示前后对比效果", "强调性价比"]
  },
  local_business: {
    style: "生活化、真实感、引流导向",
    tone: "亲切、热情、接地气",
    persona: "热情的本地老板/探店达人",
    keyPoints: ["展示最吸引人的瞬间", "突出环境氛围", "展示优惠活动", "给出明确的到店理由"]
  },
  brand_owner: {
    style: "剧情化、情感丰富、品质感",
    tone: "有温度、有态度、有情怀",
    persona: "品牌创始人/品质生活家",
    keyPoints: ["讲述品牌故事", "展示品质细节", "传递品牌价值观", "建立情感连接"]
  },
  knowledge_blogger: {
    style: "专业、易懂、干货导向",
    tone: "专业但不枯燥、亲和但有干货",
    persona: "行业专家/知识分享者",
    keyPoints: ["步骤清晰易懂", "每步控制在8秒内", "突出关键操作点", "给出具体行动建议"]
  },
  story_ip: {
    style: "剧情化、人设鲜明、情绪共鸣",
    tone: "有个性、有张力、有反转",
    persona: "有故事的人/情感主播",
    keyPoints: ["3秒钩子抓住观众", "设置转折点", "结尾反转或情感升华", "引发观众共鸣"]
  }
};

// 分析素材并给出使用建议
function analyzeMaterials(materials: any[]) {
  if (!materials || materials.length === 0) return null;
  
  return materials.map((m, index) => {
    const typeLabel = m.type === 'image' ? '图片' : m.type === 'video' ? '视频' : '文本';
    
    // 根据素材内容类型判断使用场景
    let suggestedScene = '通用展示';
    let description = m.description || '';
    
    if (description.toLowerCase().includes('产品') || description.toLowerCase().includes('包装')) {
      suggestedScene = '产品展示/开头钩子';
    } else if (description.toLowerCase().includes('使用') || description.toLowerCase().includes('效果')) {
      suggestedScene = '使用过程/效果展示';
    } else if (description.toLowerCase().includes('店铺') || description.toLowerCase().includes('环境')) {
      suggestedScene = '场景展示/环境介绍';
    } else if (description.toLowerCase().includes('人像') || description.toLowerCase().includes('人物')) {
      suggestedScene = '人设展示/口播场景';
    } else if (m.type === 'image') {
      suggestedScene = '配图展示/视觉说明';
    } else if (m.type === 'video') {
      suggestedScene = '视频片段/动态展示';
    }
    
    return {
      index: index + 1,
      type: typeLabel,
      description: description || `${typeLabel}素材`,
      suggestedScene,
      uri: m.uri
    };
  });
}

const getSystemPrompt = (
  merchantType: string, 
  materialAnalysis: any[] | null,
  videoDuration: number
) => {
  const config = MERCHANT_TYPE_CONFIG[merchantType] || MERCHANT_TYPE_CONFIG.ecommerce;
  
  let materialSection = '';
  if (materialAnalysis && materialAnalysis.length > 0) {
    materialSection = `

【素材分析结果】
${materialAnalysis.map(m => 
      `素材${m.index}：${m.type}${m.description ? `（${m.description}）` : ''}\n建议使用场景：${m.suggestedScene}`
    ).join('\n\n')}

请在脚本中合理使用这些素材，在相关部分标注使用哪个素材。`;
  } else {
    materialSection = '\n\n【素材提示】用户暂未上传素材，脚本设计时请考虑后续用户可能上传的素材类型（产品图片、使用视频、环境照片等），留出素材占位位置。';
  }
  
  return `你是一位专业的短视频脚本创作专家，精通薛辉短视频架构方法论和Veo视频生成。

【商户类型配置】
- 类型：${merchantType}
- 风格：${config.style}
- 语气：${config.tone}
- 人设：${config.persona}
- 核心要点：${config.keyPoints.join('、')}
- 视频时长：${videoDuration}秒
${materialSection}

【脚本结构要求】
1. 开头3秒钩子（必须抓住眼球）
2. 中间内容（根据选题展开）
3. 结尾引导（明确行动号召）

【分镜格式要求】
每个分镜包含：场景、地点、时间、主色调、镜号、秒数、画面描述、台词、音效

请以JSON格式返回，格式如下：
{
  "title": "脚本标题",
  "duration": ${videoDuration},
  "persona": "${config.persona}",
  "conflict": "核心冲突",
  "emotionLine": "情绪主线",
  "openingHook": {
    "visual": "画面描述",
    "script": "口播文案",
    "bgm": "音乐风格",
    "materialRef": "建议使用的素材编号"
  },
  "middleContent": [
    {
      "section": "段落说明",
      "visual": "画面描述",
      "script": "口播文案",
      "materialRef": "建议使用的素材编号或描述"
    }
  ],
  "endingGuide": {
    "visual": "画面描述",
    "script": "行动号召文案",
    "cta": "具体引导动作",
    "materialRef": "建议使用的素材编号"
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
          "soundEffect": "具体音效",
          "materialRef": "素材引用"
        }
      ]
    }
  ],
  "materialUsagePlan": "素材使用总览说明"
}`;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, topic, wordRoots, materials, merchantType, videoDuration } = body;

    if (!projectId || !topic) {
      return NextResponse.json(
        { error: "缺少必要参数：projectId 或 topic" },
        { status: 400 }
      );
    }

    const merchantTypeKey = merchantType || "ecommerce";
    const duration = videoDuration || 60;

    // 分析素材
    const materialAnalysis = analyzeMaterials(materials || []);

    const userPrompt = `【选题信息】
标题：${topic.title}
冲突点：${topic.conflict_point}
情绪钩子：${topic.emotion_hook}
词根组合：${wordRoots ? JSON.stringify(wordRoots) : '未提供'}
${materials && materials.length > 0 ? `已上传素材：${materials.length}个` : '暂未上传素材'}

请生成完整的逐镜脚本，时长${duration}秒。`;

    // 提取请求头
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    
    // 调用LLM
    const responseText = await callLLM(
      getSystemPrompt(merchantTypeKey, materialAnalysis, duration),
      userPrompt,
      customHeaders,
      { temperature: 0.7 }
    );

    // 解析LLM返回的JSON
    let scriptData;
    try {
      const content = responseText;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                        content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      scriptData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("JSON解析错误:", parseError);
      scriptData = { rawContent: responseText };
    }

    // 统一字段名为前端期望的下划线格式
    const formattedScript = {
      id: `script_${Date.now()}`,
      title: scriptData.title || topic.title,
      duration: scriptData.duration || duration,
      persona: scriptData.persona || MERCHANT_TYPE_CONFIG[merchantTypeKey]?.persona || "",
      conflict: scriptData.conflict || topic.conflict_point,
      emotion_line: scriptData.emotionLine || topic.emotion_hook,
      opening_hook: scriptData.openingHook || {},
      middle_content: scriptData.middleContent || [],
      ending_guide: scriptData.endingGuide || {},
      shot_list: scriptData.shotList || [],
      materialUsagePlan: scriptData.materialUsagePlan || "",
    };

    // 保存脚本到数据库 - 已注释掉 Supabase
    // const supabaseClient = getSupabaseClient();
    // const { data: savedScript, error: saveError } = await supabaseClient
    //   .from("scripts")
    //   .insert({
    //     project_id: projectId,
    //     title: scriptData.title || topic.title,
    //     duration: scriptData.duration || duration,
    //     persona: scriptData.persona || MERCHANT_TYPE_CONFIG[merchantTypeKey]?.persona || "",
    //     conflict: scriptData.conflict || topic.conflict_point,
    //     emotion_line: scriptData.emotionLine || topic.emotion_hook,
    //     opening_hook: scriptData.openingHook || {},
    //     middle_content: scriptData.middleContent || [],
    //     ending_guide: scriptData.endingGuide || {},
    //     shot_list: scriptData.shotList || [],
    //   })
    //   .select()
    //   .single();
    // if (saveError) {
    //   console.error("保存脚本失败:", saveError);
    // }
    console.log("[DB] 保存脚本:", { projectId, title: formattedScript.title });

    return NextResponse.json({
      success: true,
      script: formattedScript,
      materialAnalysis: materialAnalysis || [],
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

    // const supabaseClient = getSupabaseClient();
    // const { data, error } = await supabaseClient
    //   .from("scripts")
    //   .select("*")
    //   .eq("project_id", projectId)
    //   .order("created_at", { ascending: false })
    //   .limit(1)
    //   .single();
    // if (error && error.code !== "PGRST116") {
    //   return NextResponse.json({ error: error.message }, { status: 500 });
    // }
    // return NextResponse.json({
    //   success: true,
    //   script: data,
    // });
    console.log("[DB] 获取脚本:", { projectId });
    return NextResponse.json({
      success: true,
      script: null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "获取脚本失败" },
      { status: 500 }
    );
  }
}
