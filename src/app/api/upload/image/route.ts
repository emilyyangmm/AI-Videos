import { NextRequest, NextResponse } from "next/server";
import { S3Storage } from "coze-coding-dev-sdk";

/**
 * 图片上传 API
 * POST /api/upload/image
 * Body: { image: "data:image/...;base64,..." } 或 { imageUrl: "https://..." }
 * 返回: { success: true, url: "公网可访问URL" }
 */
export async function POST(request: NextRequest) {
  try {
    const { image, imageUrl } = await request.json();

    const storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      bucketName: process.env.COZE_BUCKET_NAME,
      region: "cn-beijing",
    });

    let imageBuffer: Buffer;
    let contentType = "image/jpeg";
    let fileName = `digital-human/${Date.now()}.jpg`;

    if (image) {
      // 处理 Data URL (data:image/...;base64,...)
      const matches = image.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        return NextResponse.json(
          { success: false, error: "无效的图片格式" },
          { status: 400 }
        );
      }
      contentType = matches[1];
      const base64Data = matches[2];
      imageBuffer = Buffer.from(base64Data, "base64");

      // 根据 contentType 生成文件名
      const ext = contentType.split("/")[1] || "jpg";
      fileName = `digital-human/${Date.now()}.${ext}`;
    } else if (imageUrl) {
      // 从 URL 下载
      console.log("[上传] 从 URL 下载图片:", imageUrl);
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return NextResponse.json(
          { success: false, error: "无法下载图片" },
          { status: 400 }
        );
      }
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      contentType = response.headers.get("content-type") || "image/jpeg";

      const ext = contentType.split("/")[1] || "jpg";
      fileName = `digital-human/${Date.now()}.${ext}`;
    } else {
      return NextResponse.json(
        { success: false, error: "缺少 image 或 imageUrl 参数" },
        { status: 400 }
      );
    }

    // 上传到对象存储
    const key = await storage.uploadFile({
      fileContent: imageBuffer,
      fileName,
      contentType,
    });

    console.log("[上传] 图片已上传, key:", key);

    // 生成公网可访问的签名 URL
    const url = await storage.generatePresignedUrl({
      key,
      expireTime: 86400 * 7, // 7天有效期
    });

    console.log("[上传] 生成访问 URL:", url);

    return NextResponse.json({
      success: true,
      url,
      key,
    });
  } catch (error) {
    console.error("[上传] 图片上传失败:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
