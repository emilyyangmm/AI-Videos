import { NextRequest, NextResponse } from "next/server";
import { LLMClient, Config, HeaderUtils } from "coze-coding-dev-sdk";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// 场景配置
const SCENARIO_CONFIG: Record<string, { focus: string; style: string }> = {
  ecommerce: {
    focus: "产品卖点、痛点解决方案、前后对比效果",
    style: "快节奏、直击痛点、强转化导向"
  },
  local_business: {
    focus: "瞬间吸引力、环境氛围、优惠活动",
    style: "生活化、真实感、引流导向"
  },
  brand_story: {
    focus: "情感共鸣、人设建立、故事转折",
    style: "剧情化、情感丰富、深度内容"
  },
  tutorial: {
    focus: "实用技巧、清晰步骤、知识点输出",
    style: "专业、易懂、干货导向"
  }
};

const SYSTEM_PROMPT = `你是一位专业的短视频爆款内容策划专家，精通薛辉短视频架构方法论。

你需要根据用户提供的行业、使用场景和视频时长，推荐3组爆款词根组合。

八大爆款元素维度：
1. 成本维度：省钱、省时、省力、一招搞定、平替、白嫖
2. 人群维度：宝妈、程序员、打工人、巨蟹座、处女座、小个子
3. 猎奇维度：反常识、揭秘、黑科技、冷知识、万万没想到
4. 反差维度：身份错位、场景反差、价值倒置、没想到你是这样的
5. "最差"元素：避坑、千万别买、最难吃、最丢脸、全网最低分
6. 头牌效应：明星同款、大佬揭秘、爱马仕工艺、CCTV报道、首富思维
7. 怀旧元素：童年回忆、20年前、小时候、老味道、经典复刻、爷青回
8. 荷尔蒙驱动：找对象、脱单、渣男/女鉴别、分手、前任、夫妻关系

推荐原则：
- 根据使用场景选择最合适的词根组合
- 根据视频时长控制信息密度
- 每组组合包含2-3个不同维度的词根
- 确保词根之间有化学反应和冲突感
- 优先推荐该行业高转化率的词根

请以JSON格式返回，格式如下：
{
  "combinations": [
    {
      "id": 1,
      "elements": ["维度1:词根", "维度2:词根", "维度3:词根"],
      "description": "推荐理由说明（需结合场景和时长说明为何推荐此组合）",
      "example": "具体示例标题",
      "suitableFor": "适合的具体场景"
    }
  ]
}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, industry, industryAnalysis } = body;
    
    // 获取场景和时长信息
    const scenario = industryAnalysis?.scenario || "ecommerce";
    const videoDuration = industryAnalysis?.videoDuration || 30;
    const scenarioConfig = SCENARIO_CONFIG[scenario] || SCENARIO_CONFIG.ecommerce;

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
        content: `行业：${industry}
使用场景：${scenario}（${scenarioConfig.focus}）
推荐风格：${scenarioConfig.style}
视频时长：${videoDuration}秒
赛道分析：${JSON.stringify(industryAnalysis, null, 2)}

请根据以上信息，推荐3组最适合该场景和时长的爆款词根组合。注意：
1. 时长${videoDuration <= 30 ? '较短，需要更直接、更有冲击力的词根' : '适中，可以包含更多故事性元素'}
2. 场景是${scenario}，需要聚焦于${scenarioConfig.focus}`,
      },
    ];

    const response = await client.invoke(messages, {
      model: "doubao-seed-1-8-251228",
      temperature: 0.8,
    });

    // 解析LLM返回的JSON
    let combinations;
    try {
      const content = response.content;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                        content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      combinations = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("JSON解析错误:", parseError);
      combinations = { combinations: [] };
    }

    // 保存词根组合到数据库
    const supabaseClient = getSupabaseClient();
    
    if (combinations.combinations && combinations.combinations.length > 0) {
      const wordRootsData = combinations.combinations.map((combo: any) => ({
        project_id: projectId,
        combination: combo,
        is_selected: false,
      }));

      const { error: insertError } = await supabaseClient
        .from("word_roots")
        .insert(wordRootsData);

      if (insertError) {
        console.error("保存词根组合失败:", insertError);
      }
    }

    return NextResponse.json({
      success: true,
      combinations: combinations.combinations || [],
    });
  } catch (error) {
    console.error("词根组合推荐失败:", error);
    return NextResponse.json(
      { error: "词根组合推荐失败，请稍后重试" },
      { status: 500 }
    );
  }
}
