import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// 获取单个项目详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getSupabaseClient();

    // 获取项目基本信息
    const { data: project, error: projectError } = await client
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    // 获取关联的词根组合
    const { data: wordRoots } = await client
      .from("word_roots")
      .select("*")
      .eq("project_id", id);

    // 获取关联的选题
    const { data: topics } = await client
      .from("topics")
      .select("*")
      .eq("project_id", id);

    // 获取关联的素材
    const { data: materials } = await client
      .from("materials")
      .select("*")
      .eq("project_id", id);

    // 获取关联的脚本
    const { data: scripts } = await client
      .from("scripts")
      .select("*")
      .eq("project_id", id);

    // 获取关联的视频
    const { data: videos } = await client
      .from("videos")
      .select("*")
      .eq("project_id", id);

    return NextResponse.json({
      success: true,
      project: {
        ...project,
        wordRoots: wordRoots || [],
        topics: topics || [],
        materials: materials || [],
        scripts: scripts || [],
        videos: videos || [],
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "获取项目详情失败" },
      { status: 500 }
    );
  }
}

// 更新项目
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const client = getSupabaseClient();

    const { data, error } = await client
      .from("projects")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, project: data });
  } catch (error) {
    return NextResponse.json(
      { error: "更新项目失败" },
      { status: 500 }
    );
  }
}

// 删除项目
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getSupabaseClient();

    const { error } = await client.from("projects").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "删除项目失败" },
      { status: 500 }
    );
  }
}
