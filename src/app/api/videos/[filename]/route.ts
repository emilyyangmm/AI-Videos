import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * 提供本地生成的视频文件下载
 * GET /api/videos/:filename
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    if (!filename) {
      return NextResponse.json(
        { success: false, error: "缺少文件名" },
        { status: 400 }
      );
    }

    // 安全校验：只允许 .mp4 文件，防止路径遍历攻击
    if (!filename.endsWith(".mp4") || filename.includes("..") || filename.includes("/")) {
      return NextResponse.json(
        { success: false, error: "无效的文件名" },
        { status: 400 }
      );
    }

    const filepath = join("/tmp/veo_videos", filename);

    // 检查文件是否存在
    if (!existsSync(filepath)) {
      return NextResponse.json(
        { success: false, error: "文件不存在" },
        { status: 404 }
      );
    }

    // 读取文件
    const fileBuffer = readFileSync(filepath);

    // 返回视频文件
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("视频下载错误:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
