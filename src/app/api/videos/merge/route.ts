import { NextRequest, NextResponse } from "next/server";
import { execSync, spawn } from "child_process";
import { writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";

const VIDEO_DIR = "/tmp/veo_videos";

/**
 * 视频合并 API
 * POST /api/videos/merge
 * 
 * Body: {
 *   videos: [
 *     {
 *       url: "/api/videos/xxx.mp4",  // 视频 URL
 *       shotId: "S01",               // 分镜 ID
 *       dialogue: "台词文字",         // 字幕文字（可选）
 *       duration: 8,                 // 时长（秒）
 *       transition: "fade"           // 转场效果：none/fade（可选）
 *     }
 *   ],
 *   bgm: "upbeat",                   // 背景音乐风格（可选，暂时忽略）
 *   addSubtitles: true,              // 是否添加字幕
 *   aspectRatio: "16:9"             // 视频比例
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videos, addSubtitles = true, aspectRatio = "16:9" } = body;

    if (!videos || !Array.isArray(videos) || videos.length === 0) {
      return NextResponse.json(
        { success: false, error: "缺少视频列表" },
        { status: 400 }
      );
    }

    // 确保目录存在
    if (!existsSync(VIDEO_DIR)) {
      mkdirSync(VIDEO_DIR, { recursive: true });
    }

    // 检查 FFmpeg 是否安装
    try {
      execSync("ffmpeg -version", { stdio: "ignore" });
    } catch {
      return NextResponse.json(
        { success: false, error: "服务器未安装 FFmpeg，请联系管理员" },
        { status: 500 }
      );
    }

    // 把视频 URL 转成本地文件路径
    const localPaths: string[] = [];
    for (const video of videos) {
      const url = video.url || video.videoUrl || "";
      
      if (url.startsWith("/api/videos/") || url.startsWith("/api/materials/file")) {
        // 本地视频文件
        const filename = url.split("/").pop() || "";
        const filepath = join(VIDEO_DIR, filename);
        if (!existsSync(filepath)) {
          return NextResponse.json(
            { success: false, error: `视频文件不存在: ${filename}` },
            { status: 400 }
          );
        }
        localPaths.push(filepath);
      } else if (url.startsWith("gs://")) {
        // GCS 上的视频，暂不支持
        return NextResponse.json(
          { success: false, error: "GCS 存储的视频暂不支持合并，请先下载到本地" },
          { status: 400 }
        );
      } else if (url.startsWith("http")) {
        // 网络视频URL，需要下载
        // TODO: 实现下载逻辑
        return NextResponse.json(
          { success: false, error: `网络视频暂不支持合并，请使用本地视频` },
          { status: 400 }
        );
      } else {
        return NextResponse.json(
          { success: false, error: `不支持的视频地址格式: ${url}` },
          { status: 400 }
        );
      }
    }

    const timestamp = Date.now();
    const outputFilename = `merged_${timestamp}.mp4`;
    const outputPath = join(VIDEO_DIR, outputFilename);

    // ============================================================
    // 方案一：简单拼接（不加字幕）
    // ============================================================
    if (!addSubtitles) {
      // 生成 filelist.txt
      const filelistPath = join(VIDEO_DIR, `filelist_${timestamp}.txt`);
      const filelistContent = localPaths
        .map(p => `file '${p}'`)
        .join("\n");
      writeFileSync(filelistPath, filelistContent);

      try {
        execSync(
          `ffmpeg -f concat -safe 0 -i "${filelistPath}" -c copy "${outputPath}" -y`,
          { timeout: 120000 }
        );
        unlinkSync(filelistPath);
      } catch (err) {
        try { unlinkSync(filelistPath); } catch {}
        console.error("FFmpeg 拼接失败:", err);
        return NextResponse.json(
          { success: false, error: "视频拼接失败: " + String(err) },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        video_url: `/api/videos/${outputFilename}`,
        message: "视频合并完成",
        totalVideos: videos.length,
      });
    }

    // ============================================================
    // 方案二：拼接 + 添加字幕
    // ============================================================

    // 第一步：先把所有视频拼接成一个临时文件
    const tempMergedPath = join(VIDEO_DIR, `temp_merged_${timestamp}.mp4`);
    const filelistPath = join(VIDEO_DIR, `filelist_${timestamp}.txt`);
    const filelistContent = localPaths
      .map(p => `file '${p}'`)
      .join("\n");
    writeFileSync(filelistPath, filelistContent);

    try {
      execSync(
        `ffmpeg -f concat -safe 0 -i "${filelistPath}" -c copy "${tempMergedPath}" -y`,
        { timeout: 120000 }
      );
      unlinkSync(filelistPath);
    } catch (err) {
      try { unlinkSync(filelistPath); } catch {}
      return NextResponse.json(
        { success: false, error: "视频拼接失败: " + String(err) },
        { status: 500 }
      );
    }

    // 第二步：计算每段视频的字幕时间轴
    // 根据每个视频的 duration 计算开始和结束时间
    const subtitleEntries: string[] = [];
    let currentTime = 0;

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const duration = video.duration || 8;
      const dialogue = video.dialogue || "";

      if (dialogue && dialogue.trim()) {
        // 字幕从该片段开始0.5秒后显示，到结束前0.5秒消失
        const startTime = currentTime + 0.5;
        const endTime = currentTime + duration - 0.5;
        
        // 转义单引号（FFmpeg drawtext 需要）
        const escapedText = dialogue
          .replace(/'/g, "\\'")
          .replace(/:/g, "\\:")
          .replace(/\[/g, "\\[")
          .replace(/\]/g, "\\]");

        subtitleEntries.push(
          `drawtext=text='${escapedText}':` +
          `fontsize=28:` +
          `fontcolor=white:` +
          `bordercolor=black:` +
          `borderw=2:` +
          `x=(w-text_w)/2:` +
          `y=h-th-40:` +
          `enable='between(t,${startTime.toFixed(2)},${endTime.toFixed(2)})'`
        );
      }

      currentTime += duration;
    }

    // 第三步：如果有字幕，叠加字幕；否则直接用临时文件
    if (subtitleEntries.length > 0) {
      const filterComplex = subtitleEntries.join(",");
      
      try {
        execSync(
          `ffmpeg -i "${tempMergedPath}" -vf "${filterComplex}" -codec:a copy "${outputPath}" -y`,
          { timeout: 180000 }
        );
        // 删除临时文件
        try { unlinkSync(tempMergedPath); } catch {}
      } catch (err) {
        try { unlinkSync(tempMergedPath); } catch {}
        console.error("字幕叠加失败:", err);
        // 字幕失败就用无字幕版本
        try {
          execSync(`mv "${tempMergedPath}" "${outputPath}"`);
        } catch {}
        return NextResponse.json({
          success: true,
          video_url: `/api/videos/${outputFilename}`,
          message: "视频合并完成（字幕添加失败，已输出无字幕版本）",
          totalVideos: videos.length,
          subtitleFailed: true,
        });
      }
    } else {
      // 没有字幕，直接重命名临时文件
      try {
        execSync(`mv "${tempMergedPath}" "${outputPath}"`);
      } catch (err) {
        return NextResponse.json(
          { success: false, error: "文件处理失败" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      video_url: `/api/videos/${outputFilename}`,
      message: `视频合并完成，共 ${videos.length} 个片段${subtitleEntries.length > 0 ? `，已添加 ${subtitleEntries.length} 条字幕` : ""}`,
      totalVideos: videos.length,
      subtitleCount: subtitleEntries.length,
      totalDuration: videos.reduce((sum: number, v: any) => sum + (v.duration || 8), 0),
    });

  } catch (error) {
    console.error("视频合并异常:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * 查询合并状态（预留，当前同步处理）
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename");
  
  if (!filename) {
    return NextResponse.json({ error: "缺少 filename 参数" }, { status: 400 });
  }
  
  const filepath = join(VIDEO_DIR, filename);
  const exists = existsSync(filepath);
  
  return NextResponse.json({
    exists,
    video_url: exists ? `/api/videos/${filename}` : null,
  });
}
