import { NextRequest, NextResponse } from "next/server";
// import { getSupabaseClient } from "@/storage/database/supabase-client";

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
 * 获取图片并转为 base64
 * 支持相对路径和绝对路径
 */
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    // 处理相对路径：服务端fetch需要完整URL
    let fetchUrl = url;
    if (url.startsWith('/api/') || url.startsWith('/public/')) {
      // 使用当前服务运行的端口（优先级：PORT > DEPLOY_RUN_PORT > 默认3001）
      const port = process.env.PORT || process.env.DEPLOY_RUN_PORT || '3001';
      fetchUrl = `http://localhost:${port}${url}`;
      console.log(`[fetchImageAsBase64] 相对路径转换为: ${fetchUrl}`);
    }
    
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      console.error("获取图片失败:", response.status, fetchUrl);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return base64;
  } catch (error) {
    console.error("图片转 base64 失败:", error);
    return null;
  }
}

/**
 * 保存 base64 视频到本地
 */
async function saveBase64Video(base64Data: string): Promise<string> {
  const { writeFileSync, mkdirSync, existsSync } = await import("fs");
  const { join } = await import("path");
  
  const dir = "/tmp/veo_videos";
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`;
  const filepath = join(dir, filename);
  
  writeFileSync(filepath, Buffer.from(base64Data, "base64"));
  
  // 返回 API URL
  return `/api/videos/${filename}`;
}

/**
 * Veo 视频生成API
 * 
 * POST: 批量提交视频生成任务
 * - 接收优化后的分镜列表（每个8秒）
 * - 为每个分镜创建Veo任务
 * - 返回所有operation_name供轮询
 * 
 * GET: 查询单个任务状态
 * - 轮询视频生成状态
 * - 返回完成后的视频URL
 */

/**
 * 提交 Veo 视频生成任务（批量）
 * POST /api/veo/generate
 * 
 * Body: {
 *   projectId: string,
 *   shots: [{
 *     shotId: string,
 *     veoPrompt: { chinese: string, english: string },
 *     audioPrompt: { chinese: string, english: string },
 *     parameters: { aspectRatio, duration, generateAudio }
 *   }],
 *   materials?: [{ shotIndex, type, url, category }] // 可选：用户上传的素材
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, shots, materials, aspectRatio = "16:9" } = body;

    // 验证参数
    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "缺少 projectId" },
        { status: 400 }
      );
    }

    if (!shots || !Array.isArray(shots) || shots.length === 0) {
      return NextResponse.json(
        { success: false, error: "缺少 shots 数组或数组为空" },
        { status: 400 }
      );
    }

    const token = await getAccessToken();
    if (!token) {
      return NextResponse.json(
        { success: false, error: "认证失败，请检查服务账号凭证。确保设置了 GOOGLE_APPLICATION_CREDENTIALS 环境变量。" },
        { status: 500 }
      );
    }

    // 批量提交任务
    const results = [];
    
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      
      // 使用英文提示词（Veo要求）
      const prompt = shot.veoPrompt?.english || shot.veoPrompt?.chinese || "";
      
      if (!prompt) {
        results.push({
          shotIndex: i,
          shotId: shot.shotId,
          success: false,
          error: "缺少提示词",
        });
        continue;
      }

      // 从 shot.parameters?.duration 读取时长，限制在 [4, 6, 8]
      const allowedDurations = [4, 6, 8];
      const requestedDuration = shot.parameters?.duration || shot.duration || 8;
      const duration = allowedDurations.includes(requestedDuration) 
        ? requestedDuration 
        : 8;

      // 构建 instance，支持图生视频
      const instance: any = { prompt };

      // 如果该分镜有对应素材，加入图片
      if (materials && materials.length > 0) {
        const shotMaterial = materials.find((m: any) => 
          m.shotIndex === i && m.type === "image"
        );
        
        if (shotMaterial?.url) {
          console.log(`📷 分镜 ${i + 1} 找到图片素材:`, shotMaterial.url);
          const imageBase64 = await fetchImageAsBase64(shotMaterial.url);
          
          if (imageBase64) {
            instance.image = {
              bytesBase64Encoded: imageBase64,
              mimeType: "image/jpeg",
            };
            console.log(`✅ 分镜 ${i + 1} 图片已添加到请求`);
          } else {
            console.warn(`⚠️ 分镜 ${i + 1} 图片处理失败，将使用纯文本生成`);
          }
        }
      }
      
      const payload = {
        instances: [instance],
        parameters: {
          aspectRatio: shot.parameters?.aspectRatio || aspectRatio,
          durationSeconds: duration,
          outputConfig: {
            gcsDestination: {
              outputUriPrefix: GCS_OUTPUT,
            },
          },
        },
      };

      console.log(`🚀 提交分镜 ${i + 1}/${shots.length}:`, prompt.slice(0, 100));
      
      try {
        const response = await fetch(VEO_GENERATE_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const responseText = await response.text();
        
        if (!response.ok) {
          results.push({
            shotIndex: i,
            shotId: shot.shotId,
            success: false,
            error: `HTTP ${response.status}: ${responseText.slice(0, 200)}`,
          });
          continue;
        }

        const data = JSON.parse(responseText);
        const operationName = data.name;

        // 保存到数据库 - 已注释掉 Supabase
        // const supabaseClient = getSupabaseClient();
        // await supabaseClient.from("videos").insert({
        //   project_id: projectId,
        //   status: "processing",
        //   veo_operation_id: operationName,
        //   duration: duration,
        // });
        console.log("[DB] 保存视频任务:", { projectId, operationName, duration });

        results.push({
          shotIndex: i,
          shotId: shot.shotId,
          success: true,
          operationName,
          prompt: prompt.slice(0, 100) + "...",
          hasImage: !!instance.image,
        });

        console.log(`✅ 分镜 ${i + 1} 任务已提交:`, operationName, instance.image ? "(含图片)" : "(纯文本)");
        
      } catch (error) {
        results.push({
          shotIndex: i,
          shotId: shot.shotId,
          success: false,
          error: String(error),
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const imageCount = results.filter(r => r.hasImage).length;
    
    return NextResponse.json({
      success: true,
      message: `成功提交 ${successCount}/${shots.length} 个视频生成任务（其中 ${imageCount} 个使用图片）`,
      totalShots: shots.length,
      successCount,
      imageCount,
      results,
    });
  } catch (error) {
    console.error("❌ Veo 批量生成异常:", error);
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
      // 更新数据库 - 已注释掉 Supabase
      // const supabaseClient = getSupabaseClient();
      // await supabaseClient
      //   .from("videos")
      //   .update({ status: "completed", video_url: gcsUri })
      //   .eq("veo_operation_id", operationName);
      console.log("[DB] 更新视频状态:", { operationName, gcsUri });

      return NextResponse.json({
        success: true,
        done: true,
        gcs_uri: gcsUri,
        video_url: `https://storage.cloud.google.com/${gcsUri.replace("gs://", "")}`,
      });
    }

    // 处理 base64 视频 - 保存到本地而不是 Coze S3
    const base64Data = video.bytesBase64Encoded;
    if (base64Data) {
      try {
        // 保存到本地 /tmp 目录
        const videoUrl = await saveBase64Video(base64Data);

        // 更新数据库 - 已注释掉 Supabase
        // const supabaseClient = getSupabaseClient();
        // await supabaseClient
        //   .from("videos")
        //   .update({ status: "completed", video_url: videoUrl })
        //   .eq("veo_operation_id", operationName);
        console.log("[DB] 更新视频状态(base64):", { operationName, videoUrl });

        return NextResponse.json({
          success: true,
          done: true,
          video_url: videoUrl,
        });
      } catch (saveError) {
        console.error("保存视频失败:", saveError);
        return NextResponse.json({
          success: false,
          done: true,
          error: "保存视频文件失败: " + String(saveError),
        });
      }
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
