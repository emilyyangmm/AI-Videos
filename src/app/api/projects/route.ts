import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { z } from "zod";

// 创建项目的请求schema
const createProjectSchema = z.object({
  industry: z.string().min(1),
  scenario: z.string().optional(),      // 使用场景
  videoDuration: z.number().optional(), // 视频时长（秒）
});

// 创建新项目
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createProjectSchema.parse(body);

    const client = getSupabaseClient();
    
    // 构建项目数据，将场景和时长信息存储在 industry_analysis 中
    const projectData: any = {
      industry: validatedData.industry,
      status: "draft",
    };
    
    // 如果有场景和时长信息，存储到 industry_analysis
    if (validatedData.scenario || validatedData.videoDuration) {
      projectData.industry_analysis = {
        scenario: validatedData.scenario,
        videoDuration: validatedData.videoDuration,
      };
    }

    const { data, error } = await client
      .from("projects")
      .insert(projectData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, project: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "参数验证失败", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "创建项目失败" },
      { status: 500 }
    );
  }
}

// 获取项目列表
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const status = searchParams.get("status");

    let query = client
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, projects: data });
  } catch (error) {
    return NextResponse.json(
      { error: "获取项目列表失败" },
      { status: 500 }
    );
  }
}
