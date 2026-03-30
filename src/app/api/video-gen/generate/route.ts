import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";

const ARK_VIDEO_API_KEY = process.env.ARK_VIDEO_API_KEY || "";

export async function POST(request: NextRequest) {
  try {
    const userInfo = getUserFromRequest(request);
    if (!userInfo) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const { prompt, imageUrl, mode = "t2v", resolution = "720p", duration = 5, ratio = "16:9" } = await request.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ success: false, error: "请输入视频描述" }, { status: 400 });
    }

    if (prompt.length > 300) {
      return NextResponse.json({ success: false, error: "视频描述不能超过300字" }, { status: 400 });
    }

    console.log("[视频生成] 开始生成:", { mode, resolution, duration, ratio, hasImage: !!imageUrl });

    const content: any[] = [
      {
        type: "text",
        text: `${prompt.trim()} --resolution ${resolution} --duration ${duration} --ratio ${ratio} --watermark false`
      }
    ];

    // 图生视频模式
    if (mode === "i2v" && imageUrl) {
      content.push({ type: "image_url", image_url: { url: imageUrl } });
    }

    const model = mode === "i2v"
      ? "doubao-seedance-1-0-lite-i2v-250428"
      : "doubao-seedance-1-0-lite-t2v-250428";

    console.log("[视频生成] 使用模型:", model);

    const res = await fetch("https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ARK_VIDEO_API_KEY}`,
      },
      body: JSON.stringify({ model, content }),
    });

    const data = await res.json();
    console.log("[视频生成] 提交结果:", data);

    if (!data.id) {
      throw new Error(data.error?.message || "任务提交失败");
    }

    return NextResponse.json({ success: true, task_id: data.id });
  } catch (error: any) {
    console.error("[视频生成] 错误:", error.message || error);
    return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
}
