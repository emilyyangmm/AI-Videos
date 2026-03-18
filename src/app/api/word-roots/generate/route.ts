import { NextRequest, NextResponse } from "next/server";
import { LLMClient, Config, HeaderUtils } from "coze-coding-dev-sdk";
import { getSupabaseClient } from "@/storage/database/supabase-client";

const SYSTEM_PROMPT = `你是一位专业的短视频爆款内容策划专家，精通薛辉短视频架构方法论。

你需要根据用户提供的行业和赛道分析结果，推荐3组爆款词根组合。

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
- 每组组合包含2-3个不同维度的词根
- 确保词根之间有化学反应和冲突感
- 优先推荐该行业高转化率的词根

请以JSON格式返回，格式如下：
{
  "combinations": [
    {
      "id": 1,
      "elements": ["维度1:词根", "维度2:词根", "维度3:词根"],
      "description": "推荐理由说明",
      "example": "具体示例标题"
    }
  ]
}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, industry, industryAnalysis } = body;

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
赛道分析：${JSON.stringify(industryAnalysis, null, 2)}

请推荐3组爆款词根组合。`,
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
