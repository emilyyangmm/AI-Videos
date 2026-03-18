import { NextRequest, NextResponse } from "next/server";
import { S3Storage } from "coze-coding-dev-sdk";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// 素材上传
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const projectId = formData.get("projectId") as string;
    const type = formData.get("type") as string;
    const description = formData.get("description") as string;
    const shotIndex = formData.get("shotIndex") as string | null;
    const category = formData.get("category") as string | null;
    const file = formData.get("file") as File | null;
    const url = formData.get("url") as string | null;

    if (!projectId || !type) {
      return NextResponse.json(
        { error: "缺少必要参数：projectId 或 type" },
        { status: 400 }
      );
    }

    const supabaseClient = getSupabaseClient();
    const materialData: Record<string, any> = {
      project_id: projectId,
      type,
      description,
      shot_index: shotIndex ? parseInt(shotIndex) : null,
      category: category,
    };

    if (file && (type === "image" || type === "video")) {
      const storage = new S3Storage({
        endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
        accessKey: "",
        secretKey: "",
        bucketName: process.env.COZE_BUCKET_NAME,
        region: "cn-beijing",
      });

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const fileKey = await storage.uploadFile({
        fileContent: buffer,
        fileName: `materials/${projectId}/${Date.now()}_${file.name}`,
        contentType: file.type,
      });

      const accessUrl = await storage.generatePresignedUrl({
        key: fileKey,
        expireTime: 86400 * 30,
      });

      materialData.file_key = fileKey;
      materialData.url = accessUrl;
    } else if (url) {
      materialData.url = url;
    }

    const { data, error } = await supabaseClient
      .from("materials")
      .insert(materialData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, material: data });
  } catch (error) {
    console.error("素材上传失败:", error);
    return NextResponse.json({ error: "素材上传失败" }, { status: 500 });
  }
}

// 获取项目的素材列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "缺少参数：projectId" }, { status: 400 });
    }

    const supabaseClient = getSupabaseClient();
    const { data, error } = await supabaseClient
      .from("materials")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, materials: data });
  } catch (error) {
    return NextResponse.json({ error: "获取素材列表失败" }, { status: 500 });
  }
}

// 删除素材
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const materialId = searchParams.get("id");

    if (!materialId) {
      return NextResponse.json({ error: "缺少参数：id" }, { status: 400 });
    }

    const supabaseClient = getSupabaseClient();

    const { data: material } = await supabaseClient
      .from("materials")
      .select("file_key")
      .eq("id", materialId)
      .single();

    if (material?.file_key) {
      const storage = new S3Storage({
        endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
        accessKey: "",
        secretKey: "",
        bucketName: process.env.COZE_BUCKET_NAME,
        region: "cn-beijing",
      });
      await storage.deleteFile({ fileKey: material.file_key });
    }

    const { error } = await supabaseClient
      .from("materials")
      .delete()
      .eq("id", materialId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "删除素材失败" }, { status: 500 });
  }
}
