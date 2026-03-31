import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// 火山引擎配置
const VOLCENGINE_ACCESS_KEY = process.env.VOLCENGINE_ACCESS_KEY || "";
const VOLCENGINE_SECRET_KEY = process.env.VOLCENGINE_SECRET_KEY || "";

// 火山引擎 API 配置
const VOLCENGINE_SERVICE = "cv";
const VOLCENGINE_REGION = "cn-north-1";
const VOLCENGINE_HOST = "visual.volcengineapi.com";
const VOLCENGINE_VERSION = "2022-08-31";

/**
 * 修正后的火山引擎签名生成（与 generate/route.ts 完全一致）
 */
function generateVolcengineSignature(
  method: string,
  path: string,
  query: Record<string, string>,
  body: string,
  accessKey: string,
  secretKey: string
): { authorization: string; xDate: string } {
  const now = new Date();
  const xDate = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const shortDate = xDate.substring(0, 8);

  const hashedPayload = crypto.createHash("sha256").update(body).digest("hex");

  // 1. 构建 Query String (保持字典序)
  const sortedQuery = Object.keys(query)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
    .join("&");

  // 2. 构建 Canonical Headers (必须包含 host, x-content-sha256, x-date)
  const canonicalHeaders = `content-type:application/json\nhost:${VOLCENGINE_HOST}\nx-content-sha256:${hashedPayload}\nx-date:${xDate}\n`;
  const signedHeaders = "content-type;host;x-content-sha256;x-date";

  // 3. 构建 Canonical Request (简化版，减少换行符错误风险)
  // CanonicalRequest 的各部分之间只有一个 \n
  const canonicalRequest = [
    method.toUpperCase(),
    path,
    sortedQuery,
    canonicalHeaders, // 这里末尾已经带了一个 \n
    signedHeaders,
    hashedPayload
  ].join("\n");

  // 4. 构建 StringToSign
  const algorithm = "HMAC-SHA256";
  const credentialScope = `${shortDate}/${VOLCENGINE_REGION}/${VOLCENGINE_SERVICE}/request`;
  const hashedCanonicalRequest = crypto
    .createHash("sha256")
    .update(canonicalRequest)
    .digest("hex");
    
  const stringToSign = [
    algorithm,
    xDate,
    credentialScope,
    hashedCanonicalRequest,
  ].join("\n");

  // 5. 计算 HMAC-SHA256 签名
  const kDate = crypto.createHmac("sha256", secretKey).update(shortDate).digest();
  const kRegion = crypto.createHmac("sha256", kDate).update(VOLCENGINE_REGION).digest();
  const kService = crypto.createHmac("sha256", kRegion).update(VOLCENGINE_SERVICE).digest();
  const kSigning = crypto.createHmac("sha256", kService).update("request").digest();
  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  const authorization = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { authorization, xDate };
}

/**
 * 调用火山引擎 API（与 generate/route.ts 完全一致）
 */
async function callVolcengineAPI(
  action: string,
  reqKey: string,
  payload: Record<string, any>
): Promise<any> {
  const path = "/";
  const query: Record<string, string> = {
    Action: action,
    Version: VOLCENGINE_VERSION,
  };
  const body = JSON.stringify({ req_key: reqKey, ...payload });

  const { authorization, xDate } = generateVolcengineSignature(
    "POST",
    path,
    query,
    body,
    VOLCENGINE_ACCESS_KEY,
    VOLCENGINE_SECRET_KEY
  );

  // 使用 URLSearchParams 确保 URL 上的参数顺序与签名时一致
  const searchParams = new URLSearchParams(query);
  const url = `https://${VOLCENGINE_HOST}/?${searchParams.toString()}`;

  const hashedBody = crypto.createHash("sha256").update(body).digest("hex");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Host": VOLCENGINE_HOST,
      "X-Date": xDate,
      "X-Content-Sha256": hashedBody,
      "Authorization": authorization,
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`火山引擎API调用失败: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  if (data.ResponseMetadata?.Error) {
    throw new Error(
      `火山引擎API错误: ${data.ResponseMetadata.Error.Code} - ${data.ResponseMetadata.Error.Message}`
    );
  }

  return data;
}

/**
 * 查询火山引擎任务状态
 * 注意：CVGetResult 的 req_key 应该与提交任务时一致
 */
async function queryTaskStatus(taskId: string): Promise<any> {
  // 使用 omni_v15 的 req_key 来查询（与 generate/route.ts 一致）
  const result = await callVolcengineAPI(
    "CVGetResult",
    "jimeng_realman_avatar_picture_omni_v15",
    { task_id: taskId }
  );
  return result;
}

/**
 * 数字人任务状态查询 API
 * GET /api/digital-human/status?taskId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    // 登录验证
    const { getUserFromRequest } = await import("@/lib/auth");
    const userInfo = getUserFromRequest(request);
    if (!userInfo) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: "缺少 taskId 参数" },
        { status: 400 }
      );
    }

    console.log(`[数字人状态] 查询任务: ${taskId}`);

    // 查询任务状态
    let result;
    try {
      result = await queryTaskStatus(taskId);
      console.log(`[数字人状态] API返回:`, JSON.stringify(result).substring(0, 500));
    } catch (apiError) {
      console.error(`[数字人状态] API调用失败:`, apiError);
      throw apiError;
    }

    const status = result.data?.status;
    const videoUrl = result.data?.video_url;
    const progress = result.data?.progress || 0;
    const errorMessage = result.data?.error_message;

    // 状态映射（兼容火山引擎可能的多种状态值）
    // 火山引擎状态: PENDING, RUNNING, SUCCESS, FAILED, done, success
    let mappedStatus: string;
    if (status === "SUCCESS" || status === "success" || status === "done") {
      mappedStatus = "completed";
    } else if (status === "FAILED" || status === "failed") {
      mappedStatus = "failed";
    } else if (status === "RUNNING" || status === "running") {
      mappedStatus = "processing";
    } else {
      mappedStatus = "pending";
    }

    console.log(`[数字人状态] 任务 ${taskId} 原始状态: ${status}, 映射后: ${mappedStatus}, 进度: ${progress}%`);

    // 构建响应
    const response: any = {
      success: true,
      task_id: taskId,
      status: mappedStatus,
      progress: progress,
    };

    // 如果完成，返回视频URL
    if ((mappedStatus === "completed" || mappedStatus === "done") && videoUrl) {
      response.status = "done";
      response.video_url = videoUrl;
      response.message = "视频生成完成";
    } else if (mappedStatus === "failed") {
      response.error = errorMessage || "视频生成失败";
      response.message = errorMessage || "视频生成失败";
    } else {
      response.message = `正在生成中... (${progress}%)`;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[数字人状态] 查询异常:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
