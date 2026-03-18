import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// Veo 配置
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "red-atlas-490409-v1";
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
const GCS_OUTPUT = process.env.GCS_OUTPUT_URI || "gs://red-atlas-video-assets/outputs/";

// Veo API 端点
const VEO_GENERATE_URL = `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/veo-3.1-generate-001:predictLongRunning`;
const VEO_FETCH_URL = `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/veo-3.1-generate-001:fetchPredictOperation`;

// 缓存 token
let cachedToken: { token: string; expiry: number } | null = null;

/**
 * 获取 Google Cloud Access Token
 * 使用服务账号 JSON 文件认证
 */
async function getAccessToken(): Promise<string | null> {
  // 检查缓存的 token 是否有效
  if (cachedToken && cachedToken.expiry > Date.now()) {
    return cachedToken.token;
  }

  try {
    const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credsPath) {
      console.error("未设置 GOOGLE_APPLICATION_CREDENTIALS 环境变量");
      return null;
    }

    // 读取服务账号 JSON
    const fs = await import("fs");
    const serviceAccount = JSON.parse(fs.readFileSync(credsPath, "utf-8"));

    // 创建 JWT
    const now = Math.floor(Date.now() / 1000);
    const jwtHeader = { alg: "RS256", typ: "JWT" };
    const jwtPayload = {
      iss: serviceAccount.client_email,
      sub: serviceAccount.client_email,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
      scope: "https://www.googleapis.com/auth/cloud-platform",
    };

    // 使用 crypto 签名
    const crypto = await import("crypto");
    const privateKey = serviceAccount.private_key;

    const headerB64 = Buffer.from(JSON.stringify(jwtHeader))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    const payloadB64 = Buffer.from(JSON.stringify(jwtPayload))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    const signatureInput = `${headerB64}.${payloadB64}`;
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(signatureInput);
    const signature = sign
      .sign(privateKey, "base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    const jwt = `${signatureInput}.${signature}`;

    // 用 JWT 换取 Access Token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("获取 Token 失败:", errorText);
      return null;
    }

    const tokenData = await tokenResponse.json();
    
    // 缓存 token（提前5分钟过期）
    cachedToken = {
      token: tokenData.access_token,
      expiry: Date.now() + (tokenData.expires_in - 300) * 1000,
    };

    return tokenData.access_token;
  } catch (error) {
    console.error("认证失败:", error);
    return null;
  }
}

/**
 * 提交 Veo 视频生成任务
 * POST /api/veo/generate
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, duration = 8, aspectRatio = "16:9", projectId, shotIndex } = body;

    if (!prompt) {
      return NextResponse.json({ success: false, error: "请输入提示词" }, { status: 400 });
    }

    // Veo 只支持 4/6/8 秒
    const validDuration = [4, 6, 8].includes(duration) ? duration : 8;

    const token = await getAccessToken();
    if (!token) {
      return NextResponse.json(
        { success: false, error: "认证失败，请检查服务账号凭证" },
        { status: 500 }
      );
    }

    const payload = {
      instances: [{ prompt }],
      parameters: {
        aspectRatio,
        durationSeconds: validDuration,
        outputConfig: {
          gcsDestination: {
            outputUriPrefix: GCS_OUTPUT,
          },
        },
      },
    };

    console.log("🚀 提交 Veo 请求:", VEO_GENERATE_URL);
    
    const response = await fetch(VEO_GENERATE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log(`📊 Veo 响应 ${response.status}:`, responseText.slice(0, 300));

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `HTTP ${response.status}: ${responseText}` },
        { status: response.status }
      );
    }

    const data = JSON.parse(responseText);
    const operationName = data.name;

    console.log("✅ Veo 任务已提交:", operationName);

    // 保存到数据库
    if (projectId) {
      const supabaseClient = getSupabaseClient();
      await supabaseClient.from("videos").insert({
        project_id: projectId,
        status: "processing",
        veo_operation_id: operationName,
        duration: validDuration,
      });
    }

    return NextResponse.json({
      success: true,
      operation_name: operationName,
      message: "任务已提交，请轮询状态",
      shotIndex, // 返回分镜索引用于前端追踪
    });
  } catch (error) {
    console.error("❌ Veo 请求异常:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * 查询 Veo 任务状态
 * GET /api/veo/generate?operation_name=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const operationName = searchParams.get("operation_name");

    if (!operationName) {
      return NextResponse.json(
        { success: false, error: "缺少 operation_name 参数" },
        { status: 400 }
      );
    }

    const token = await getAccessToken();
    if (!token) {
      return NextResponse.json(
        { success: false, error: "认证失败" },
        { status: 500 }
      );
    }

    // 使用 fetchPredictOperation 查询状态
    const response = await fetch(VEO_FETCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ operationName }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { success: false, done: false, error: `HTTP ${response.status}: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const done = data.done === true;

    // 任务未完成
    if (!done) {
      return NextResponse.json({ success: true, done: false });
    }

    // 任务失败
    if (data.error) {
      return NextResponse.json({
        success: false,
        done: true,
        error: data.error.message || "未知错误",
      });
    }

    // 任务成功，提取视频
    const videos = data.response?.videos || [];
    if (videos.length === 0) {
      return NextResponse.json({
        success: false,
        done: true,
        error: "未获取到视频数据",
      });
    }

    const video = videos[0];
    
    // 优先使用 GCS URI
    const gcsUri = video.gcsUri;
    if (gcsUri) {
      // 更新数据库
      const supabaseClient = getSupabaseClient();
      await supabaseClient
        .from("videos")
        .update({ status: "completed", video_url: gcsUri })
        .eq("veo_operation_id", operationName);

      return NextResponse.json({
        success: true,
        done: true,
        gcs_uri: gcsUri,
        video_url: `https://storage.cloud.google.com/${gcsUri.replace("gs://", "")}`,
      });
    }

    // 处理 base64 视频
    const base64Data = video.bytesBase64Encoded;
    if (base64Data) {
      // 保存到对象存储
      const { S3Storage } = await import("coze-coding-dev-sdk");
      const storage = new S3Storage({
        endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
        bucketName: process.env.COZE_BUCKET_NAME,
        region: "cn-beijing",
      });

      const buffer = Buffer.from(base64Data, "base64");
      const fileKey = await storage.uploadFile({
        fileContent: buffer,
        fileName: `veo-videos/${Date.now()}.mp4`,
        contentType: "video/mp4",
      });

      const videoUrl = await storage.generatePresignedUrl({
        key: fileKey,
        expireTime: 86400 * 30, // 30天
      });

      // 更新数据库
      const supabaseClient = getSupabaseClient();
      await supabaseClient
        .from("videos")
        .update({ status: "completed", video_url: videoUrl })
        .eq("veo_operation_id", operationName);

      return NextResponse.json({
        success: true,
        done: true,
        video_url: videoUrl,
      });
    }

    return NextResponse.json({
      success: false,
      done: true,
      error: "视频数据为空",
    });
  } catch (error) {
    console.error("❌ 查询状态异常:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
