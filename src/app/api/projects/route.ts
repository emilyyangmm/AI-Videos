import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { insertProjectSchema } from "@/storage/database/shared/schema";
import { z } from "zod";

// 创建新项目
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = insertProjectSchema.parse(body);

    const client = getSupabaseClient();
    const { data, error } = await client
      .from("projects")
      .insert({
        industry: validatedData.industry,
        status: "draft",
      })
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
