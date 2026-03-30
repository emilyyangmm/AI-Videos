import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";

const ARK_API_KEY = process.env.ARK_API_KEY || "";

export async function POST(request: NextRequest) {
  try {
    const userInfo = getUserFromRequest(request);
    if (!userInfo) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const { prompt, referenceImage } = await request.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ success: false, error: "请输入图片描述" }, { status: 400 });
    }
    if (prompt.length > 300) {
      return NextResponse.json({ success: false, error: "描述不能超过300字" }, { status: 400 });
    }

    // 检查参考图大小
    if (referenceImage) {
      const base64Size = referenceImage.length * 0.75 / 1024 / 1024;
      if (base64Size > 5) {
        return NextResponse.json({ success: false, error: "参考图不能超过5MB" }, { status: 400 });
      }
    }

    let url: string;
    let body: Record<string, any>;

    if (referenceImage) {
      // 图生图
      url = "https://ark.cn-beijing.volces.com/api/v3/images/generations";
      body = {
        model: "doubao-seedream-5-0-260128",
        prompt: prompt.trim(),
        image: referenceImage,
        size: "2K",
        output_format: "png",
        watermark: false,
      };
    } else {
      // 文生图
      url = "https://ark.cn-beijing.volces.com/api/v3/images/generations";
      body = {
        model: "doubao-seedream-3-0-t2i-250415",
        prompt: prompt.trim(),
        response_format: "url",
        size: "1024x1024",
        watermark: false,
      };
    }

    console.log(`[文生图] 模式: ${referenceImage ? "图生图" : "文生图"}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ARK_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`文生图失败: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;

    if (!imageUrl) throw new Error("未获取到图片URL");

    console.log(`[文生图] 生成成功: ${imageUrl}`);

    return NextResponse.json({ success: true, image_url: imageUrl });
  } catch (error) {
    console.error("[文生图] 生成异常:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
