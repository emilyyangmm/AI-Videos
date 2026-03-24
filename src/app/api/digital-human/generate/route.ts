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

// 动作风格映射（中文 -> 英文描述）
const MOTION_STYLES: Record<string, string> = {
  natural: "natural speaking with subtle body movements, relaxed posture",
  gesture: "energetic hand gestures while speaking, enthusiastic presentation",
  lively: "lively and animated movements, dynamic presentation style",
  calm: "calm and composed demeanor, steady and professional posture",
  professional: "professional presentation style, confident body language"
};

// 豆包语音合成模型2.0音色列表（字符版，用户实际开通的音色）
const VOICE_OPTIONS = [
  // 通用场景音色（后缀 _uranus_bigtts）
  { id: "zh_female_vv_uranus_bigtts", name: "vivi 2.0", desc: "通用女声，适合多种场景" },
  { id: "zh_female_xiaohe_uranus_bigtts", name: "小何", desc: "通用女声，自然亲切" },
  { id: "zh_male_m191_uranus_bigtts", name: "云舟", desc: "成熟男声，适合品牌背书" },
  { id: "zh_male_taocheng_uranus_bigtts", name: "小天", desc: "阳光男声，适合知识博主" },
  { id: "en_male_tim_uranus_bigtts", name: "Tim", desc: "英文男声，适合英文内容" },
  // 角色扮演音色（后缀 _tob）
  { id: "saturn_zh_female_cancan_tob", name: "知性灿灿", desc: "角色扮演，知性优雅" },
  { id: "saturn_zh_female_keainvsheng_tob", name: "可爱女生", desc: "角色扮演，活泼可爱" },
  { id: "saturn_zh_female_tiaopigongzhu_tob", name: "调皮公主", desc: "角色扮演，俏皮灵动" },
  { id: "saturn_zh_male_shuanglangshaonian_tob", name: "爽朗少年", desc: "角色扮演，阳光帅气" },
  { id: "saturn_zh_male_tiancaitongzhuo_tob", name: "天才同桌", desc: "角色扮演，邻家少年" },
];

// 声音风格映射（前端传来的voiceStyle映射到音色ID）
const VOICE_TYPES: Record<string, string> = {
  // 默认音色
  default: "zh_female_vv_uranus_bigtts",
  // 通用场景音色
  zh_female_vv_uranus_bigtts: "zh_female_vv_uranus_bigtts",
  zh_female_xiaohe_uranus_bigtts: "zh_female_xiaohe_uranus_bigtts",
  zh_male_m191_uranus_bigtts: "zh_male_m191_uranus_bigtts",
  zh_male_taocheng_uranus_bigtts: "zh_male_taocheng_uranus_bigtts",
  en_male_tim_uranus_bigtts: "en_male_tim_uranus_bigtts",
  // 角色扮演音色
  saturn_zh_female_cancan_tob: "saturn_zh_female_cancan_tob",
  saturn_zh_female_keainvsheng_tob: "saturn_zh_female_keainvsheng_tob",
  saturn_zh_female_tiaopigongzhu_tob: "saturn_zh_female_tiaopigongzhu_tob",
  saturn_zh_male_shuanglangshaonian_tob: "saturn_zh_male_shuanglangshaonian_tob",
  saturn_zh_male_tiancaitongzhuo_tob: "saturn_zh_male_tiancaitongzhuo_tob",
};

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
 * 调用火山引擎 API
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

  const url = `https://${VOLCENGINE_HOST}/?Action=${action}&Version=${VOLCENGINE_VERSION}`;

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
 * 调用 TTS 生成音频（火山引擎豆包语音合成模型2.0 V3 SSE接口）
 * 文档：https://www.volcengine.com/docs/6561/1329505
 */
async function generateTTS(
  script: string,
  voiceStyle: string
): Promise<{ audioUrl: string; duration: number }> {
  const appId = process.env.VOLCENGINE_TTS_APP_ID || "";
  const token = process.env.VOLCENGINE_TTS_TOKEN || "";
  const voiceType = VOICE_TYPES[voiceStyle] || VOICE_TYPES.default;

  if (!appId || !token) {
    throw new Error("TTS配置缺失：请设置 VOLCENGINE_TTS_APP_ID 和 VOLCENGINE_TTS_TOKEN");
  }

  // 豆包语音合成模型2.0字符版的资源ID（文档要求）
  const resourceId = "seed-tts-2.0";
  
  // 生成唯一的连接ID和会话ID
  const connectId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();

  console.log("[TTS] 调用火山引擎豆包语音合成模型2.0 V3 SSE API...");
  console.log("[TTS] voice_type:", voiceType, "connect_id:", connectId, "session_id:", sessionId);
  
  // 使用 V3 HTTP SSE 单向流式接口
  const ttsResponse = await fetch("https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-App-Key": appId,
      "X-Api-Access-Key": token,
      "X-Api-Resource-Id": resourceId,
      "X-Api-Connect-Id": connectId,
      // 可选：请求返回用量数据
      "X-Control-Require-Usage-Tokens-Return": "text_words",
    },
    body: JSON.stringify({
      user: {
        uid: "user_001"
      },
      req_params: {
        text: script.trim(),
        speaker: voiceType,
        audio_params: {
          format: "mp3",
          sample_rate: 24000,
        },
      },
    }),
  });

  if (!ttsResponse.ok) {
    const errText = await ttsResponse.text();
    throw new Error(`TTS失败: ${ttsResponse.status} - ${errText}`);
  }

  // 处理 SSE 流式响应
  const reader = ttsResponse.body?.getReader();
  if (!reader) {
    throw new Error("无法读取TTS响应流");
  }

  const decoder = new TextDecoder();
  let audioChunks: Buffer[] = [];
  let hasError = false;
  let errorMessage = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log("[TTS] SSE流读取完成");
        break;
      }

      // 解析 SSE 数据
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data:')) {
          const data = line.substring(5).trim();
          if (!data) continue;
          
          try {
            const json = JSON.parse(data);
            
            // 检查错误事件
            if (json.event === 'Error' || json.code && json.code !== 20000000) {
              hasError = true;
              errorMessage = json.message || json.msg || "未知错误";
              console.error("[TTS] 错误事件:", json);
              break;
            }
            
            // 收集音频数据（event=TTSResponse）
            if (json.event === 'TTSResponse' && json.data) {
              const audioBuffer = Buffer.from(json.data, 'base64');
              audioChunks.push(audioBuffer);
              console.log(`[TTS] 收到音频块，大小: ${audioBuffer.length} bytes, 累计: ${audioChunks.length} 块`);
            }
          } catch (parseError) {
            console.warn("[TTS] JSON解析失败:", data, parseError);
          }
        }
      }
      
      if (hasError) break;
    }
  } finally {
    reader.releaseLock();
  }

  if (hasError) {
    throw new Error(`TTS合成失败: ${errorMessage}`);
  }

  if (audioChunks.length === 0) {
    throw new Error("TTS合成失败：未收到音频数据");
  }

  // 合并所有音频块
  const audioBuffer = Buffer.concat(audioChunks);
  console.log(`[TTS] 音频合成完成，总大小: ${audioBuffer.length} bytes`);
  
  // 将音频保存到本地文件
  const fs = await import("fs");
  const path = await import("path");
  
  const audioDir = "/tmp/veo_audio";
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }
  
  const filename = `tts_${Date.now()}.mp3`;
  const filepath = path.join(audioDir, filename);
  fs.writeFileSync(filepath, audioBuffer);
  
  console.log(`[TTS] 音频已保存: ${filepath}`);
  
  // 返回本地文件路径（后续需要上传到对象存储获取公网URL）
  const audioUrl = filepath;
  const duration = Math.ceil(script.length / 4.5); // 预估时长

  return { audioUrl, duration };
}

/**
 * 数字人视频生成 API
 * POST /api/digital-human/generate
 *
 * Body: {
 *   portraitImage: string,     // 人像图片URL
 *   script: string,            // 口播文案
 *   voiceStyle: string,        // 声音风格
 *   motionStyle: string,       // 动作风格
 *   backgroundImage?: string,  // 背景图片URL（可选）
 *   aspectRatio?: "16:9" | "9:16"  // 视频比例
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      portraitImage,
      script,
      voiceStyle = "female_gentle",
      motionStyle = "natural",
      backgroundImage,
      aspectRatio = "9:16",
    } = body;

    // 参数验证
    if (!portraitImage) {
      return NextResponse.json(
        { success: false, error: "请上传人像图片" },
        { status: 400 }
      );
    }

    if (!script || script.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "请提供口播文案" },
        { status: 400 }
      );
    }

    console.log(`[数字人] 开始生成，文案长度: ${script.length}`);

    // ==========================================
    // 第一步：生成 TTS 音频
    // ==========================================
    console.log("[数字人] 步骤1: 生成TTS音频...");
    const { audioUrl, duration } = await generateTTS(script, voiceStyle);
    console.log(`[数字人] 音频已生成，预估时长: ${duration}秒`);

    // ==========================================
    // 第二步：主体识别 (Person Detect)
    // ==========================================
    console.log("[数字人] 步骤2: 主体识别...");
    const personDetectResult = await callVolcengineAPI(
      "CVSyncToCVSubmitTask",
      "seehair_sdk_person_detect",
      {
        image_url: portraitImage,
      }
    );

    const subjectInfo = personDetectResult.Data?.subject_info;
    if (!subjectInfo) {
      throw new Error("主体识别失败：未检测到人物");
    }
    console.log("[数字人] 主体识别完成");

    // ==========================================
    // 第三步：主体检测 (Detection)
    // ==========================================
    console.log("[数字人] 步骤3: 主体检测...");
    const detectionResult = await callVolcengineAPI(
      "CVSyncToCVSubmitTask",
      "omni_human_detection",
      {
        image_url: portraitImage,
        subject_info: subjectInfo,
      }
    );

    const detectionInfo = detectionResult.Data?.detection_info;
    if (!detectionInfo) {
      throw new Error("主体检测失败");
    }
    console.log("[数字人] 主体检测完成");

    // ==========================================
    // 第四步：视频生成
    // ==========================================
    console.log("[数字人] 步骤4: 提交视频生成任务...");
    const motionMode = MOTION_STYLES[motionStyle] || MOTION_STYLES.natural;

    const videoPayload: Record<string, any> = {
      audio_url: audioUrl,
      image_url: portraitImage,
      subject_info: subjectInfo,
      detection_info: detectionInfo,
      resolution: aspectRatio === "9:16" ? "720p" : "720p",
      motion_mode: motionMode,
    };

    // 添加背景图片（可选）
    if (backgroundImage) {
      videoPayload.background_url = backgroundImage;
    }

    const videoResult = await callVolcengineAPI(
      "CVSyncToCVSubmitTask",
      "omni_human_v1.5",
      videoPayload
    );

    const taskId = videoResult.Data?.task_id;
    if (!taskId) {
      throw new Error("视频生成任务提交失败：未获取到任务ID");
    }

    console.log(`[数字人] 视频生成任务已提交: ${taskId}`);

    // ==========================================
    // 返回任务信息
    // ==========================================
    return NextResponse.json({
      success: true,
      task_id: taskId,
      audio_duration: duration,
      status: "processing",
      message: "数字人视频生成任务已提交，请轮询查询状态",
    });
  } catch (error) {
    console.error("[数字人] 生成异常:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
