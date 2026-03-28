import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { callGemini } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const userInfo = getUserFromRequest(request);
    if (!userInfo) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const { text } = await request.json();
    if (!text?.trim()) {
      return NextResponse.json({ success: false, error: "请输入要改写的文案" }, { status: 400 });
    }
    if (text.length > 2000) {
      return NextResponse.json({ success: false, error: "文案不能超过2000字" }, { status: 400 });
    }

    // 调用 Gemini 进行文案改写
    const prompt = `请将以下视频文案进行改写，保留核心内容和意思，但换一种表达方式，使其更加生动自然，避免与原文雷同。改写后的文案应该：
1. 保持原意不变
2. 语言更加流畅生动
3. 避免重复用词
4. 适合视频口播

原文：
${text}

请直接输出改写后的文案，不需要任何解释：`;

    const rewrittenText = await callGemini(prompt);

    return NextResponse.json({ success: true, rewritten_text: rewrittenText.trim() });
  } catch (error) {
    console.error("[Rewrite] 改写错误:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
