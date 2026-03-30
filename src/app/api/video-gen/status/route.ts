import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";

const ARK_VIDEO_API_KEY = process.env.ARK_VIDEO_API_KEY || "";

export async function GET(request: NextRequest) {
  try {
    const userInfo = getUserFromRequest(request);
    if (!userInfo) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const taskId = request.nextUrl.searchParams.get("taskId");
    if (!taskId) {
      return NextResponse.json({ success: false, error: "缺少taskId" }, { status: 400 });
    }

    console.log("[视频生成] 查询状态:", taskId);

    const res = await fetch(
      `https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/${taskId}`,
      { headers: { "Authorization": `Bearer ${ARK_VIDEO_API_KEY}` } }
    );

    const data = await res.json();
    console.log("[视频生成] 查询结果:", data);

    if (data.status === "succeeded") {
      const videoUrl = data.content?.video_url || data.output?.video_url;
      return NextResponse.json({ success: true, status: "done", video_url: videoUrl });
    } else if (data.status === "failed") {
      return NextResponse.json({ success: true, status: "failed", error: data.error?.message || "生成失败" });
    } else {
      return NextResponse.json({ success: true, status: "processing" });
    }
  } catch (error: any) {
    console.error("[视频生成] 查询错误:", error.message || error);
    return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
}
