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

    // 计算总时长
    const totalDuration = images.length * duration;

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

    // list.txt 路径（用于拼接）
    const listPath = join(tmpDir, "list.txt");

    // 第一步：把每张图片转成独立视频片段（优化：降低分辨率、提高编码速度）
    console.log("[混剪] 第一步：生成视频片段...");
    const segPaths: string[] = [];
    for (let i = 0; i < imagePaths.length; i++) {
      const segPath = join(tmpDir, `seg_${i}.mp4`);
      console.log(`[混剪] 处理图片 ${i + 1}/${images.length}`);
      execSync(
        `ffmpeg -loop 1 -i "${imagePaths[i]}" -vf "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p" -t ${duration} -c:v libx264 -preset ultrafast -crf 28 -r 15 -y "${segPath}" 2>&1`,
        { timeout: 30000, stdio: "pipe" }
      );
      segPaths.push(segPath);
    }

    // 第二步：生成拼接列表
    console.log("[混剪] 第二步：生成拼接列表...");
    const concatContent = segPaths.map(p => `file '${p}'`).join("\n");
    writeFileSync(listPath, concatContent);
    console.log("[混剪] 拼接列表:", concatContent);

    // 第三步：拼接视频并加BGM
    console.log("[混剪] 第三步：拼接视频并添加BGM...");
    execSync(
      `ffmpeg -f concat -safe 0 -i "${listPath}" -i "${bgmPath}" -c:v copy -c:a aac -b:a 128k -shortest -y "${outputPath}" 2>&1`,
      { timeout: 180000, stdio: "pipe" }
    );

    // 清理临时文件
    try {
      for (const p of imagePaths) unlinkSync(p);
      for (const p of segPaths) unlinkSync(p);
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
