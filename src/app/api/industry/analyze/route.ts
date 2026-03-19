import { NextRequest, NextResponse } from "next/server";
import { callLLM, HeaderUtils } from "@/lib/llm";
// import { getSupabaseClient } from "@/storage/database/supabase-client";

// 商户类型配置
const MERCHANT_TYPE_CONFIG: Record<string, { focus: string; style: string; recommendedElements: string }> = {
  ecommerce: {
    focus: "产品卖点、痛点解决方案、前后对比效果",
    style: "快节奏、直击痛点、强转化导向",
    recommendedElements: "成本+人群+最差"
  },
  local_business: {
    focus: "瞬间吸引力、环境氛围、优惠活动",
    style: "生活化、真实感、引流导向",
    recommendedElements: "人群+猎奇+怀旧"
  },
  brand_owner: {
    focus: "品牌认知、情怀故事、品质感",
    style: "剧情化、情感丰富、品质感",
    recommendedElements: "头牌效应+反差+荷尔蒙"
  },
  knowledge_blogger: {
    focus: "实用技巧、专业信任、知识点输出",
    style: "专业、易懂、干货导向",
    recommendedElements: "猎奇+成本+头牌效应"
  },
  story_ip: {
    focus: "人设建立、情感共鸣、剧情内容",
    style: "剧情化、人设鲜明、情绪共鸣",
    recommendedElements: "反差+荷尔蒙+怀旧"
  }
};

const getSystemPrompt = (merchantType: string) => {
  const config = MERCHANT_TYPE_CONFIG[merchantType] || MERCHANT_TYPE_CONFIG.ecommerce;
  
  return `你是一位专业的短视频内容策略专家，精通薛辉短视频架构方法论。

当前商户类型：${merchantType}
核心聚焦：${config.focus}
推荐爆款元素方向：${config.recommendedElements}

你的任务是分析用户输入的行业，结合商户类型特点，提供：
1. 目标人群特征分析（年龄、性别、痛点、需求，需结合商户类型）
2. 推荐的变现方式（需与商户类型匹配，至少3种）
3. 适合该行业+商户类型的爆款元素组合方向

请以JSON格式返回，格式如下：
{
  "targetAudience": {
    "description": "人群特征一句话描述",
    "age": "年龄范围",
    "gender": "性别分布",
    "painPoints": ["痛点1", "痛点2", "痛点3"],
    "needs": ["需求1", "需求2", "需求3"]
  },
  "monetizationMethods": [
    {"method": "变现方式", "description": "具体说明"}
  ],
  "recommendedElements": "推荐的爆款元素组合方向（如：成本+人群+最差）"
}`;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, industry, merchantType } = body;

    if (!projectId || !industry) {
      return NextResponse.json(
        { error: "缺少必要参数：projectId 或 industry" },
        { status: 400 }
      );
    }

    const merchantTypeKey = merchantType || "ecommerce";
    const config = MERCHANT_TYPE_CONFIG[merchantTypeKey] || MERCHANT_TYPE_CONFIG.ecommerce;

    const userPrompt = `请分析以下行业：${industry}

商户类型：${merchantTypeKey}（${config.focus}）

请结合商户类型特点，给出针对性的分析结果。`;

    // 提取请求头
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    
    // 调用LLM
    const responseText = await callLLM(
      getSystemPrompt(merchantTypeKey),
      userPrompt,
      customHeaders,
      { temperature: 0.7 }
    );

    // 解析LLM返回的JSON
    let analysisResult;
    try {
      // 提取JSON部分（可能包含markdown代码块）
      const content = responseText;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                        content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      analysisResult = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("JSON解析错误:", parseError);
      analysisResult = { rawContent: responseText };
    }

    // 更新项目记录 - 已注释掉 Supabase
    // const supabaseClient = getSupabaseClient();
    // const { error: updateError } = await supabaseClient
    //   .from("projects")
    //   .update({
    //     industry_analysis: {
    //       ...analysisResult,
    //       merchantType: merchantTypeKey,
    //     },
    //     updated_at: new Date().toISOString(),
    //   })
    //   .eq("id", projectId);
    // if (updateError) {
    //   console.error("更新项目失败:", updateError);
    // }
    console.log("[DB] 更新项目分析结果:", { projectId, merchantType: merchantTypeKey });

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
