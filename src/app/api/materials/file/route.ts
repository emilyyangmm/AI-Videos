import { NextRequest, NextResponse } from "next/server";
import { existsSync, createReadStream, statSync } from "fs";

/**
 * 素材文件读取API
 * GET /api/materials/file?path=/tmp/materials/xxx.jpg
 * 
 * 功能：
 * 1. 安全校验文件路径（防止路径穿越攻击）
 * 2. 只允许访问 /tmp/materials/ 目录
 * 3. 支持Range请求（视频流式播放）
 * 4. 自动识别文件类型
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get("path");

    // 安全校验：防止路径穿越攻击
    if (!filePath || filePath.includes("..")) {
      return NextResponse.json({ error: "无效路径" }, { status: 400 });
    }

    // 只允许访问 /tmp/materials/ 目录
    if (!filePath.startsWith("/tmp/materials/")) {
      return NextResponse.json({ error: "路径不允许" }, { status: 403 });
    }

    // 检查文件是否存在
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "文件不存在" }, { status: 404 });
    }

    const stat = statSync(filePath);
    const ext = filePath.split(".").pop()?.toLowerCase();
    
    // 根据扩展名设置Content-Type
    const contentType = 
      ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
      ext === "png" ? "image/png" :
      ext === "gif" ? "image/gif" :
      ext === "webp" ? "image/webp" :
      ext === "mp4" ? "video/mp4" :
      ext === "webm" ? "video/webm" :
      "application/octet-stream";

    // 处理Range请求（支持视频流式播放）
    const range = request.headers.get("range");
    
    if (range) {
      // 解析Range请求头
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;

      // 创建读取流
      const stream = createReadStream(filePath, { start, end });
      const webStream = new ReadableStream({
        start(controller) {
          stream.on("data", (chunk) => controller.enqueue(chunk));
          stream.on("end", () => controller.close());
          stream.on("error", (err) => controller.error(err));
        },
      });

      // 返回206 Partial Content
      return new NextResponse(webStream, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(chunkSize),
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // 普通请求：返回完整文件
    const stream = createReadStream(filePath);
    const webStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
    });

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(stat.size),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("素材文件读取失败:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
