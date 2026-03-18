import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { S3Storage } from "coze-coding-dev-sdk";

interface VideoSegment {
  videoUrl: string;
  duration: number;
  startTime?: number;
  endTime?: number;
  transition?: string;
}

// 自动剪辑API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, videoSegments } = body;

    if (!projectId || !videoSegments || videoSegments.length === 0) {
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 }
      );
    }

    // 生成FFmpeg剪辑命令（前端可执行或后端使用fluent-ffmpeg处理）
    const ffmpegCommand = generateFFmpegCommand(videoSegments);

    // 保存剪辑配置
    const supabaseClient = getSupabaseClient();
    const { data: editRecord, error } = await supabaseClient
      .from("videos")
      .insert({
        project_id: projectId,
        status: "editing",
        duration: videoSegments.reduce((sum: number, seg: VideoSegment) => sum + seg.duration, 0),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      editId: editRecord.id,
      ffmpegCommand,
      message: "剪辑配置已生成，请在前端执行或使用后端处理",
    });
  } catch (error) {
    console.error("自动剪辑失败:", error);
    return NextResponse.json(
      { error: "自动剪辑失败" },
      { status: 500 }
    );
  }
}

// 获取剪辑配置
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "缺少参数：projectId" }, { status: 400 });
    }

    const supabaseClient = getSupabaseClient();
    const { data: videos, error } = await supabaseClient
      .from("videos")
      .select("*")
      .eq("project_id", projectId)
      .eq("status", "completed");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 生成推荐剪辑方案
    const editPlan = generateEditPlan(videos || []);

    return NextResponse.json({
      success: true,
      videos,
      editPlan,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "获取剪辑配置失败" },
      { status: 500 }
    );
  }
}

// 生成FFmpeg剪辑命令
function generateFFmpegCommand(segments: VideoSegment[]): string {
  const inputs = segments.map((seg, i) => `-i "${seg.videoUrl}"`).join(" ");
  
  const filterComplex = segments.map((seg, i) => {
    const trim = seg.startTime !== undefined && seg.endTime !== undefined
      ? `[${i}:v]trim=start=${seg.startTime}:end=${seg.endTime},setpts=PTS-STARTPTS[v${i}];`
      : `[${i}:v]null[v${i}];`;
    return trim;
  }).join(" ");

  const concatInputs = segments.map((_, i) => `[v${i}]`).join("");
  
  const transitions = segments.map((seg, i) => {
    if (seg.transition === "fade") {
      return `fade=t=in:st=0:d=0.5,fade=t=out:st=${seg.duration - 0.5}:d=0.5`;
    }
    return "";
  }).filter(t => t).join(",");

  return `ffmpeg ${inputs} -filter_complex "${filterComplex}${concatInputs}concat=n=${segments.length}:v=1:a=0[outv]" -map "[outv]" output.mp4`;
}

// 生成剪辑方案
function generateEditPlan(videos: any[]): any {
  return {
    recommendedDuration: Math.min(videos.reduce((sum, v) => sum + (v.duration || 5), 0), 60),
    transitions: ["fade", "wipe", "dissolve"],
    bgmSuggestions: ["欢快", "温馨", "动感", "治愈"],
    textOverlays: [
      { position: "bottom", style: "subtitle", content: "自动生成字幕" },
    ],
    segments: videos.map((v, i) => ({
      order: i + 1,
      videoId: v.id,
      videoUrl: v.video_url,
      duration: v.duration || 5,
      suggestedTransition: i === 0 ? "none" : "fade",
    })),
  };
}
