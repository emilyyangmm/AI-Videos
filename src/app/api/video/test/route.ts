import { NextRequest, NextResponse } from "next/server";
import { generateVideo, HeaderUtils } from "@/lib/video";

/**
 * 测试内置视频生成API
 * GET /api/video/test - 测试生成一个简单的视频
 * POST /api/video/test - 使用自定义提示词生成视频
 */
export async function GET(request: NextRequest) {
  try {
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    
    // 使用简单提示词测试
    const result = await generateVideo(
      "一只橘色的小猫在阳光下打盹，镜头缓慢推进",
      {
        duration: 5,
        ratio: "16:9",
        resolution: "720p",
        generateAudio: true,
      },
      customHeaders
    );

    return NextResponse.json({
      success: true,
      message: "视频生成成功（沙箱内置服务）",
      videoUrl: result.videoUrl,
      taskId: result.taskId,
    });
  } catch (error) {
    console.error("视频生成失败:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: String(error),
        hint: "请确保在沙箱环境中测试",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, duration, ratio, resolution } = body;
    
    if (!prompt) {
      return NextResponse.json(
        { error: "缺少必要参数：prompt" },
        { status: 400 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    
    const result = await generateVideo(
      prompt,
      {
        duration: duration || 8,
        ratio: ratio || "16:9",
        resolution: resolution || "720p",
        generateAudio: true,
      },
      customHeaders
    );

    return NextResponse.json({
      success: true,
      videoUrl: result.videoUrl,
      taskId: result.taskId,
    });
  } catch (error) {
    console.error("视频生成失败:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
