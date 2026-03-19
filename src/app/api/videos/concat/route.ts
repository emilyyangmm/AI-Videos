import { NextRequest, NextResponse } from "next/server";

/**
 * 视频拼接合成API
 * 
 * 功能：
 * 1. 接收多个视频URL
 * 2. 按顺序拼接成一个完整视频
 * 3. 返回合成后的视频URL
 * 
 * 注意：当前沙箱环境使用简单的URL列表返回
 * 生产环境需要接入真实的视频处理服务
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videos, projectId } = body;

    if (!videos || !Array.isArray(videos) || videos.length === 0) {
      return NextResponse.json(
        { error: "缺少视频列表或列表为空" },
        { status: 400 }
      );
    }

    console.log(`[视频合成] 收到 ${videos.length} 个视频片段`);

    // 过滤出有效的视频URL
    const validVideos = videos.filter((v: any) => v.videoUrl && v.videoUrl.startsWith('http'));
    
    if (validVideos.length === 0) {
      return NextResponse.json(
        { error: "没有有效的视频URL" },
        { status: 400 }
      );
    }

    // 计算总时长
    const totalDuration = validVideos.reduce((sum: number, v: any) => {
      const duration = v.duration || 4;
      return sum + duration;
    }, 0);

    // 在沙箱环境中，我们返回一个拼接后的信息
    // 实际生产环境应该调用FFmpeg或其他视频处理服务
    const concatResult = {
      success: true,
      projectId,
      totalVideos: validVideos.length,
      totalDuration,
      videos: validVideos.map((v: any, index: number) => ({
        index: index + 1,
        url: v.videoUrl,
        duration: v.duration || 4,
        shotId: v.shotId
      })),
      // 合成视频的播放列表（用于前端连续播放）
      playlistUrl: validVideos.map((v: any) => v.videoUrl).join(','),
      // 模拟合成后的视频URL（生产环境应该返回真实的合成视频）
      mergedVideoUrl: null,
      message: `成功准备 ${validVideos.length} 个视频片段，总时长 ${totalDuration} 秒`
    };

    console.log(`[视频合成] 完成，总时长: ${totalDuration}秒`);

    return NextResponse.json(concatResult);

  } catch (error) {
    console.error("[视频合成] 失败:", error);
    return NextResponse.json(
      { error: "视频合成失败: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}
