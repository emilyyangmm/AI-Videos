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
 * 生成火山引擎签名
 * 参考: https://www.volcengine.com/docs/6369/67269
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

  // 构建查询字符串
  const sortedQuery = Object.keys(query)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
    .join("&");

  // 构建 CanonicalRequest
  const hashedPayload = crypto.createHash("sha256").update(body).digest("hex");
  const canonicalHeaders = `content-type:application/json\nhost:${VOLCENGINE_HOST}\nx-content-sha256:${hashedPayload}\nx-date:${xDate}\n`;
  const signedHeaders = "content-type;host;x-content-sha256;x-date";
  const canonicalRequest = [
    method.toUpperCase(),
    path,
    sortedQuery,
    canonicalHeaders,
    signedHeaders,
    hashedPayload,
  ].join("\n");

  // 构建 StringToSign
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

  // 计算签名
  const kDate = crypto
    .createHmac("sha256", secretKey)
    .update(shortDate)
    .digest();
  const kRegion = crypto
    .createHmac("sha256", kDate)
    .update(VOLCENGINE_REGION)
    .digest();
  const kService = crypto
    .createHmac("sha256", kRegion)
    .update(VOLCENGINE_SERVICE)
    .digest();
  const kSigning = crypto
    .createHmac("sha256", kService)
    .update("request")
    .digest();
  const signature = crypto
    .createHmac("sha256", kSigning)
    .update(stringToSign)
    .digest("hex");

  // 构建 Authorization
  const authorization = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { authorization, xDate };
}

/**
 * 查询火山引擎任务状态
 */
async function queryTaskStatus(taskId: string): Promise<any> {
  const path = "/";
  const query: Record<string, string> = {
    Action: "CVGetResult",
    Version: VOLCENGINE_VERSION,
  };
  const body = JSON.stringify({
    req_key: "omni_human_v1.5",
    task_id: taskId,
  });

  const { authorization, xDate } = generateVolcengineSignature(
    "POST",
    path,
    query,
    body,
    VOLCENGINE_ACCESS_KEY,
    VOLCENGINE_SECRET_KEY
  );

  const url = `https://${VOLCENGINE_HOST}/?Action=CVGetResult&Version=${VOLCENGINE_VERSION}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Host: VOLCENGINE_HOST,
      "X-Date": xDate,
      Authorization: authorization,
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
 * 数字人任务状态查询 API
 * GET /api/digital-human/status?taskId=xxx
 */
export async function GET(request: NextRequest) {
  try {
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
    const result = await queryTaskStatus(taskId);

    const status = result.data?.status;
    const videoUrl = result.data?.video_url;
    const progress = result.data?.progress || 0;
    const errorMessage = result.data?.error_message;

    // 状态映射
    // 火山引擎状态: PENDING, RUNNING, SUCCESS, FAILED
    let mappedStatus: string;
    if (status === "SUCCESS") {
      mappedStatus = "completed";
    } else if (status === "FAILED") {
      mappedStatus = "failed";
    } else if (status === "RUNNING") {
      mappedStatus = "processing";
    } else {
      mappedStatus = "pending";
    }

    console.log(`[数字人状态] 任务 ${taskId} 状态: ${mappedStatus}, 进度: ${progress}%`);

    // 构建响应
    const response: any = {
      success: true,
      task_id: taskId,
      status: mappedStatus,
      progress: progress,
    };

    // 如果完成，返回视频URL
    if (mappedStatus === "completed" && videoUrl) {
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
