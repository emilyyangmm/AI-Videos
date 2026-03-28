import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { execSync } from "child_process";
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { join } from "path";

export async function POST(request: NextRequest) {
  try {
    const userInfo = getUserFromRequest(request);
    if (!userInfo) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const formData = await request.formData();
    const images = formData.getAll("images") as File[];
    const bgm = formData.get("bgm") as string || "bgm1";
    const duration = parseInt(formData.get("duration") as string || "3"); // 每张图片显示秒数
    const title = formData.get("title") as string || "";

    if (!images || images.length === 0) {
      return NextResponse.json({ success: false, error: "请上传至少1张图片" }, { status: 400 });
    }
    if (images.length > 10) {
      return NextResponse.json({ success: false, error: "最多上传10张图片" }, { status: 400 });
    }

    console.log("[混剪] 开始处理:", { imageCount: images.length, bgm, duration });

    const tmpDir = `/tmp/mix_${Date.now()}`;
    mkdirSync(tmpDir, { recursive: true });

    // 保存图片到临时目录
    const imagePaths: string[] = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const ext = img.name.split(".").pop() || "jpg";
      const imgPath = join(tmpDir, `img_${i}.${ext}`);
      writeFileSync(imgPath, Buffer.from(await img.arrayBuffer()));
      imagePaths.push(imgPath);
    }

    // 生成 ffmpeg 输入文件列表
    const listPath = join(tmpDir, "list.txt");
    // concat demuxer 格式：每张图片两行（file + duration），最后一张图片需要重复一次
    let listContent = "";
    for (let i = 0; i < imagePaths.length; i++) {
      listContent += `file '${imagePaths[i]}'\n`;
      listContent += `duration ${duration}\n`;
    }
    // 最后一张图片重复一次（不加 duration）
    listContent += `file '${imagePaths[imagePaths.length - 1]}'\n`;
    writeFileSync(listPath, listContent);

    console.log("[混剪] list.txt内容:", listContent);

    // 输出视频路径
    const outputDir = join(process.cwd(), "public", "uploads");
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
    const outputName = `mix_${Date.now()}.mp4`;
    const outputPath = join(outputDir, outputName);

    // BGM 路径
    const bgmPath = join(process.cwd(), "public", "bgm", `${bgm}.mp3`);

    // 检查 BGM 是否存在
    if (!existsSync(bgmPath)) {
      throw new Error(`BGM文件不存在: ${bgmPath}，请先上传BGM文件`);
    }

    // 计算总时长
    const totalDuration = images.length * duration;

    // ffmpeg 合成命令：图片 -> 视频片段 -> 拼接 + 添加BGM
    // 使用 fps 过滤器确保帧率稳定，使用 scale + pad 确保 9:16 竖屏
    const ffmpegCmd = `ffmpeg -f concat -safe 0 -i "${listPath}" -i "${bgmPath}" \
      -vf "fps=30,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black" \
      -c:v libx264 -preset fast -crf 23 \
      -c:a aac -b:a 128k \
      -shortest -t ${totalDuration} \
      -y "${outputPath}" 2>&1`;

    console.log("[混剪] 开始合成...");
    console.log("[混剪] 命令:", ffmpegCmd);

    execSync(ffmpegCmd, { timeout: 180000, stdio: "pipe" });

    // 清理临时文件
    try {
      for (const p of imagePaths) unlinkSync(p);
      unlinkSync(listPath);
      unlinkSync(tmpDir);
    } catch (e) { /* 忽略清理错误 */ }

    const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || "http://localhost:5000";
    const videoUrl = `${domain}/uploads/${outputName}`;

    console.log("[混剪] 完成:", videoUrl);

    return NextResponse.json({
      success: true,
      video_url: videoUrl,
      duration: totalDuration
    });
  } catch (error: any) {
    console.error("[混剪] 错误:", error.message || error);
    return NextResponse.json({
      success: false,
      error: error.message || String(error)
    }, { status: 500 });
  }
}
