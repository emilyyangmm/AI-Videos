import { NextRequest, NextResponse } from "next/server";
import { callLLM, HeaderUtils } from "@/lib/llm";
// import { getSupabaseClient } from "@/storage/database/supabase-client";

// 商户类型配置
const MERCHANT_TYPE_CONFIG: Record<string, { 
  focus: string; 
  style: string; 
  priorityElements: string[];
  reduceWeightElements: string[];
}> = {
  ecommerce: {
    focus: "产品卖点、痛点解决方案、前后对比效果",
    style: "快节奏、直击痛点、强转化导向",
    priorityElements: ["成本", "最差", "头牌", "人群"],
    reduceWeightElements: ["怀旧", "荷尔蒙"]
  },
  local_business: {
    focus: "瞬间吸引力、环境氛围、优惠活动",
    style: "生活化、真实感、引流导向",
    priorityElements: ["人群", "猎奇", "怀旧", "成本", "最差"],
    reduceWeightElements: ["头牌", "荷尔蒙"]
  },
  brand_owner: {
    focus: "品牌认知、情怀故事、品质感",
    style: "剧情化、情感丰富、品质感",
    priorityElements: ["头牌", "反差", "猎奇", "人群", "怀旧"],
    reduceWeightElements: ["成本", "最差"]
  },
  knowledge_blogger: {
    focus: "实用技巧、专业信任、知识点输出",
    style: "专业、易懂、干货导向",
    priorityElements: ["猎奇", "反差", "最差", "成本", "人群"],
    reduceWeightElements: ["荷尔蒙", "怀旧"]
  },
  story_ip: {
    focus: "人设建立、情感共鸣、剧情内容",
    style: "剧情化、人设鲜明、情绪共鸣",
    priorityElements: ["反差", "猎奇", "荷尔蒙", "人群", "怀旧"],
    reduceWeightElements: ["成本", "头牌"]
  }
};

// 行业词根权重库
const INDUSTRY_ELEMENT_WEIGHTS: Record<string, { elements: string[]; corePsychology: string }> = {
  "美妆": {
    elements: ["成本:90", "头牌:80", "最差:70", "人群:60", "猎奇:50"],
    corePsychology: "怕买贵、怕烂脸、想变美"
  },
  "母婴": {
    elements: ["成本:90", "最差:85", "怀旧:70", "人群:65", "头牌:50"],
    corePsychology: "焦虑型消费、安全第一"
  },
  "职场": {
    elements: ["成本:85", "猎奇:75", "反差:70", "最差:65", "人群:60"],
    corePsychology: "想偷懒、想走捷径、怕踩坑"
  },
  "美食": {
    elements: ["怀旧:85", "人群:75", "最差:70", "猎奇:65", "反差:50"],
    corePsychology: "情感共鸣、猎奇尝鲜"
  },
  "健身": {
    elements: ["成本:80", "人群:75", "反差:70", "头牌:60", "最差:55"],
    corePsychology: "想偷懒但想瘦、名人效应"
  },
  "科技": {
    elements: ["猎奇:90", "反差:80", "头牌:75", "最差:60", "成本:50"],
    corePsychology: "好奇心、崇拜权威"
  },
  "情感": {
    elements: ["荷尔蒙:90", "人群:80", "怀旧:75", "反差:70", "最差:55"],
    corePsychology: "情感需求、共鸣"
  },
  "搞笑": {
    elements: ["反差:95", "猎奇:80", "人群:70", "最差:60", "怀旧:50"],
    corePsychology: "意外感、幽默感"
  },
  "教育": {
    elements: ["成本:85", "最差:80", "人群:70", "头牌:65", "猎奇:55"],
    corePsychology: "怕花冤枉钱、怕选错、想省事"
  },
  "穿搭": {
    elements: ["人群:85", "成本:80", "头牌:75", "反差:65", "最差:60"],
    corePsychology: "身份认同、怕买贵、想变美"
  },
  "家居": {
    elements: ["成本:85", "最差:80", "怀旧:70", "人群:65", "猎奇:55"],
    corePsychology: "实用主义、避坑心理"
  },
  "宠物": {
    elements: ["人群:85", "怀旧:80", "最差:70", "成本:65", "反差:55"],
    corePsychology: "情感投射、身份认同"
  },
  "汽车": {
    elements: ["头牌:85", "成本:80", "猎奇:75", "反差:70", "最差:60"],
    corePsychology: "炫耀心理、性价比焦虑"
  },
  "财经": {
    elements: ["最差:90", "头牌:85", "成本:80", "猎奇:70", "人群:60"],
    corePsychology: "怕亏钱、崇拜权威、想走捷径"
  },
  "法律": {
    elements: ["最差:85", "人群:80", "猎奇:75", "头牌:65", "成本:55"],
    corePsychology: "避险心理、身份认同"
  },
  "摄影": {
    elements: ["成本:85", "头牌:80", "反差:70", "人群:65", "猎奇:55"],
    corePsychology: "性价比焦虑、名人效应"
  },
  "旅行": {
    elements: ["人群:80", "怀旧:75", "猎奇:75", "成本:70", "反差:60"],
    corePsychology: "身份认同、好奇心、性价比"
  },
  "游戏": {
    elements: ["猎奇:85", "人群:80", "反差:75", "成本:70", "怀旧:65"],
    corePsychology: "好奇心、社交需求、性价比"
  }
};

// 词根情绪映射
const ELEMENT_EMOTION_MAP: Record<string, string> = {
  "成本": "焦虑缓解+贪便宜",
  "人群": "归属感+身份认同",
  "猎奇": "好奇心+认知冲击",
  "反差": "意外感+幽默感",
  "最差": "安全感缺失+避坑欲",
  "头牌": "慕强心理+信任感",
  "怀旧": "情感共鸣+温暖感",
  "荷尔蒙": "情欲+好奇心"
};

const SYSTEM_PROMPT = `你是一位专业的短视频爆款内容策划专家，精通薛辉短视频架构方法论。

## 词根组合的底层逻辑

### 1. 词根本质是"情绪杠杆"
每个词根对应一种核心情绪：
- 成本维度：焦虑（怕花冤枉钱）+ 贪便宜
- 人群维度：归属感 + 身份认同
- 猎奇维度：好奇心 + 认知冲击
- 反差维度：意外感 + 幽默感
- 最差元素：安全感缺失 + 避坑欲
- 头牌效应：慕强心理 + 信任感
- 怀旧元素：情感共鸣 + 温暖感
- 荷尔蒙驱动：情欲 + 好奇心

### 2. 组合逻辑 = 冲突感 + 情绪叠加
词根之间要有化学反应和冲突感，本质是让两个看似不搭的情绪同时出现，产生戏剧张力。

冲突指数计算：不同类型情绪的组合冲突感更高，同类型情绪冲突感低。
- 省钱（焦虑缓解）+ 避坑（安全感）= 同类型情绪 → 冲突指数低
- 省钱（焦虑缓解）+ 万万没想到（意外感）= 不同类型情绪 → 冲突指数高

### 3. 推荐规则
- 根据行业词根权重库选择高转化词根
- 根据商户类型过滤词根（优先保留/降低权重）
- 组合生成时计算冲突指数，优先保留冲突指数高的组合
- 每组组合需包含2-3个不同维度的词根

请以JSON格式返回，格式如下：
{
  "analysis": {
    "industryPsychology": "该行业的核心用户心理",
    "filteredElements": ["经过商户类型过滤后的高权重词根列表"],
    "filterReason": "过滤理由说明"
  },
  "combinations": [
    {
      "id": 1,
      "elements": ["维度1:具体词根", "维度2:具体词根", "维度3:具体词根"],
      "conflictIndex": "高/中/低",
      "conflictAnalysis": "情绪冲突解析",
      "description": "为什么这个组合适合该场景",
      "example": "具体示例标题"
    }
  ]
}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, industry, industryAnalysis } = body;
    
    // 获取商户类型和时长信息
    const merchantType = industryAnalysis?.merchantType || "ecommerce";
    const videoDuration = industryAnalysis?.videoDuration || 30;
    const merchantConfig = MERCHANT_TYPE_CONFIG[merchantType] || MERCHANT_TYPE_CONFIG.ecommerce;

    if (!projectId || !industry) {
      return NextResponse.json(
        { error: "缺少必要参数：projectId 或 industry" },
        { status: 400 }
      );
    }

    // 获取行业词根权重配置
    const industryConfig = INDUSTRY_ELEMENT_WEIGHTS[industry] || {
      elements: ["成本:70", "人群:70", "猎奇:70", "反差:70", "最差:70"],
      corePsychology: "通用心理"
    };

    const userPrompt = `## 任务：为用户生成词根组合推荐

### 输入信息
- 行业：${industry}
- 商户类型：${merchantType}（${merchantConfig.focus}）
- 视频时长：${videoDuration}秒

### 行业词根权重库（${industry}）
${industryConfig.elements.map((e, i) => `${i + 1}. ${e.split(':')[0]}（权重${e.split(':')[1]}）`).join('\n')}

核心用户心理：${industryConfig.corePsychology}

### 商户类型过滤规则（${merchantType}）
- 优先保留：${merchantConfig.priorityElements.join('、')}
- 降低权重：${merchantConfig.reduceWeightElements.join('、')}
- 过滤理由：${merchantType === 'ecommerce' ? '要直接转化，少整虚的' : 
             merchantType === 'local_business' ? '要引流到店，需要话题性' :
             merchantType === 'brand_owner' ? '要建立品牌认知，要有逼格' :
             merchantType === 'knowledge_blogger' ? '要专业信任，要有干货' :
             '要涨粉，要有戏剧冲突'}

### 词根情绪映射
${Object.entries(ELEMENT_EMOTION_MAP).map(([k, v]) => `- ${k}：${v}`).join('\n')}

### 要求
1. 先分析：输出analysis字段，包含行业心理、过滤后的词根、过滤理由
2. 再组合：生成3组词根组合，每组需标注冲突指数和冲突解析
3. 时长${videoDuration <= 30 ? '较短（15-30秒），推荐更直接、冲击力强的词根组合' : '适中（30-60秒），可包含更多故事性元素'}
4. 确保每组组合来自至少2个不同维度
5. 优先推荐冲突指数高的组合`;

    // 提取请求头
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    
    // 调用LLM
    const responseText = await callLLM(
      SYSTEM_PROMPT,
      userPrompt,
      customHeaders,
      { temperature: 0.7 }
    );

    // 解析LLM返回的JSON
    let result;
    try {
      const content = responseText;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                        content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      result = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("JSON解析错误:", parseError);
      result = { combinations: [], analysis: {} };
    }

    // 保存词根组合到数据库 - 已注释掉 Supabase
    // const supabaseClient = getSupabaseClient();
    // if (result.combinations && result.combinations.length > 0) {
    //   const wordRootsData = result.combinations.map((combo: any) => ({
    //     project_id: projectId,
    //     combination: combo,
    //     is_selected: false,
    //   }));
    //   const { error: insertError } = await supabaseClient
    //     .from("word_roots")
    //     .insert(wordRootsData);
    //   if (insertError) {
    //     console.error("保存词根组合失败:", insertError);
    //   }
    // }
    console.log("[DB] 保存词根组合:", { projectId, combinationsCount: result.combinations?.length || 0 });

    return NextResponse.json({
      success: true,
      combinations: result.combinations || [],
      analysis: result.analysis || {},
    });
  } catch (error) {
    console.error("词根组合推荐失败:", error);
    return NextResponse.json(
      { error: "词根组合推荐失败，请稍后重试" },
      { status: 500 }
    );
  }
}
