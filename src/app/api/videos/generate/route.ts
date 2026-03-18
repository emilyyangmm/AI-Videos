import { NextRequest, NextResponse } from "next/server";
import { VideoGenerationClient, Config, HeaderUtils } from "coze-coding-dev-sdk";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// 生成视频
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, scriptId, shots } = body;

    if (!projectId || !shots || shots.length === 0) {
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new VideoGenerationClient(config, customHeaders);

    // 为每个分镜生成视频
    const videoPromises = shots.map(async (shot: any, index: number) => {
      const content = [{ type: "text" as const, text: shot.veoPrompt }];
      
      try {
        const response = await client.videoGeneration(content, {
          model: "doubao-seedance-1-5-pro-251215",
          duration: shot.duration || 5,
          ratio: "16:9",
          resolution: "720p",
          generateAudio: true,
        });

        return {
          shotIndex: index,
          success: true,
          videoUrl: response.videoUrl,
          operationId: response.response.id,
        };
      } catch (error) {
        return {
          shotIndex: index,
          success: false,
          error: error instanceof Error ? error.message : "生成失败",
        };
      }
    });

    const results = await Promise.all(videoPromises);
    const successCount = results.filter((r) => r.success).length;

    // 保存视频记录
    const supabaseClient = getSupabaseClient();
    const videoRecords = results
      .filter((r) => r.success)
      .map((r: any) => ({
        project_id: projectId,
        script_id: scriptId,
        status: "completed",
        veo_operation_id: r.operationId,
        video_url: r.videoUrl,
      }));

    if (videoRecords.length > 0) {
      await supabaseClient.from("videos").insert(videoRecords);
    }

    // 更新项目状态
    await supabaseClient
      .from("projects")
      .update({ status: "video_generated", updated_at: new Date().toISOString() })
      .eq("id", projectId);

    return NextResponse.json({
      success: true,
      message: `成功生成 ${successCount}/${shots.length} 个视频片段`,
      results,
    });
  } catch (error) {
    console.error("视频生成失败:", error);
    return NextResponse.json(
      { error: "视频生成失败" },
      { status: 500 }
    );
  }
}

// 查询单个视频状态（用于轮询）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get("videoId");

    if (!videoId) {
      return NextResponse.json({ error: "缺少参数：videoId" }, { status: 400 });
    }

    const supabaseClient = getSupabaseClient();
    const { data: video, error } = await supabaseClient
      .from("videos")
      .select("*")
      .eq("id", videoId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, video });
  } catch (error) {
    return NextResponse.json({ error: "查询视频状态失败" }, { status: 500 });
  }
}
