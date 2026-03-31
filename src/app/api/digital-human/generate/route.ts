import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { writeFileSync, mkdirSync, existsSync, copyFileSync } from "fs";
import { join } from "path";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 火山引擎配置
const VOLCENGINE_ACCESS_KEY = process.env.VOLCENGINE_ACCESS_KEY || "";
const VOLCENGINE_SECRET_KEY = process.env.VOLCENGINE_SECRET_KEY || "";

// 火山引擎 API 配置
// 这里的配置必须完全一致，一个字母都不要改
const VOLCENGINE_SERVICE = "cv"; // 这里的 cv 是火山网关的唯一标识符
const VOLCENGINE_REGION = "cn-north-1";
const VOLCENGINE_HOST = "visual.volcengineapi.com";
const VOLCENGINE_VERSION = "2022-08-31";

// 动作风格映射（中文 -> 英文描述）
const MOTION_STYLES: Record<string, { prompt: string; tip: string }> = {
  shopping: {
    prompt: "镜头跟随，人物自信地走向镜头，举起右手展示产品，充满活力地对着镜头说话，眼神热情有力。",
    tip: "建议拍摄时手持产品，效果更佳"
  },
  professional: {
    prompt: "人物保持稳定站姿，面朝正前方说话，手势自然配合讲解内容，神情专注认真，镜头缓缓推进聚焦到面部。",
    tip: "适合正装或商务装，背景简洁为佳"
  },
  friendly: {
    prompt: "人物放松地对着镜头说话，轻微点头，嘴角带着亲切微笑，肢体自然随意，营造轻松聊天氛围。",
    tip: "适合生活化场景，穿着休闲自然"
  },
  excited: {
    prompt: "人物先做出惊喜表情，然后迅速转向镜头，双手张开抬起头，充满激情地说话，眉飞色舞，情绪高涨。",
    tip: "适合大促活动，建议配合节奏感强的文案"
  },
  authority: {
    prompt: "人物挺拔站立，面向正前方，神情严肃专业，手势稳重有力，缓缓开口说话，镜头保持稳定。",
    tip: "适合正装，建议选用简洁正式背景"
  },
  news: {
    prompt: "人物正对镜头，保持播报坐姿，神情沉稳自然，先整理一下衣领，然后对着镜头开口播报，语态严谨。",
    tip: "建议坐姿拍摄，上半身清晰入镜"
  },
  funny: {
    prompt: "人物先夸张地做出惊讶表情，眉头高挑，然后对着镜头说话，配合俏皮的手势，嘴角带着笑意。",
    tip: "适合娱乐搞笑内容，表情夸张一些效果更好"
  },
  gentle: {
    prompt: "人物神情温柔，对着镜头轻声说话，动作舒缓，轻微侧头微笑，镜头缓缓推进，聚焦到人物面部。",
    tip: "适合美妆、健康、情感类内容"
  },
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
 * 修正后的火山引擎签名生成
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
 * 调用 TTS 生成音频（火山引擎豆包语音合成模型2.0 V3 SSE接口）
 * 文档：https://www.volcengine.com/docs/6561/1329505
 */
async function generateTTS(
  script: string,
  voiceStyle: string
): Promise<string> {
  const appId = process.env.VOLCENGINE_TTS_APP_ID;
  const token = process.env.VOLCENGINE_TTS_TOKEN;
  const voiceType = VOICE_TYPES[voiceStyle] || VOICE_TYPES.default;
  
  if (!appId || !token) {
    throw new Error("TTS配置缺失：请设置 VOLCENGINE_TTS_APP_ID 和 VOLCENGINE_TTS_TOKEN");
  }
  
  console.log("[TTS] 使用 V3 SSE 接口...");
  console.log("[TTS] voice_type:", voiceType);
  
  const response = await fetch(
    "https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-App-Key": appId,
        "X-Api-Access-Key": token,
        "X-Api-Resource-Id": "seed-tts-2.0",
        "X-Api-Connect-Id": `conn_${Date.now()}`,
      },
      body: JSON.stringify({
        user: { uid: "user_001" },
        req_params: {
          text: script.trim(),
          speaker: voiceType,
          audio_params: {
            format: "mp3",
            sample_rate: 24000
          }
        }
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`TTS失败: ${response.status} - ${err}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const audioChunks: Buffer[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    for (const line of text.split("\n")) {
      if (line.startsWith("data: ")) {
        try {
          const json = JSON.parse(line.slice(6));
          if (json.data) audioChunks.push(Buffer.from(json.data, "base64"));
        } catch {}
      }
    }
  }

  if (audioChunks.length === 0) throw new Error("TTS返回空音频");

  const { writeFileSync, mkdirSync, existsSync } = await import("fs");
  const { join } = await import("path");
  const dir = "/tmp/veo_audio";
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const filename = `tts_${Date.now()}.mp3`;
  const filepath = join(dir, filename);
  writeFileSync(filepath, Buffer.concat(audioChunks));
  console.log("[TTS] 音频保存到:", filepath);
  return filepath;
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
    // 登录检查
    const userInfo = getUserFromRequest(request);
    if (!userInfo) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const body = await request.json();
    const {
      portraitImage,
      script,
      voiceStyle = "female_gentle",
      motionStyle = "natural",
      backgroundImage,
      aspectRatio = "9:16",
      prompt,
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

    // 文案字数限制（60秒 * 4.5字/秒 = 270字）
    if (script.trim().length > 270) {
      return NextResponse.json(
        { success: false, error: `文案过长（${script.trim().length}字），请控制在270字以内（约60秒）` },
        { status: 400 }
      );
    }

    // ========== 测试用：处理图片URL ==========
    // 如果是 Data URL，先保存到 public/uploads 目录，构造公网 URL
    let imageUrl = portraitImage;
    if (portraitImage.startsWith('data:')) {
      // 检查base64图片大小（5MB限制）
      const base64Size = portraitImage.length * 0.75 / 1024 / 1024;
      if (base64Size > 5) {
        return NextResponse.json(
          { success: false, error: "图片过大，请上传5MB以内的图片" },
          { status: 400 }
        );
      }
      try {
        const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000';
        // 去掉 Base64 头部
        const base64Data = portraitImage.replace(/^data:image\/\w+;base64,/, "");
        const matches = portraitImage.match(/^data:image\/(\w+);base64,/);
        const ext = matches ? matches[1] : 'png';
        
        // 保存到 public/uploads 目录
        const uploadDir = join(process.cwd(), 'public', 'uploads');
        if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
        
        const fileName = `face_${Date.now()}.${ext}`;
        const filePath = join(uploadDir, fileName);
        writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        
        // 图片缩放逻辑：限制宽度最大300像素
        const { execSync } = await import('child_process');
        const resizedPath = filePath.replace(/\.\w+$/, '_resized.jpg');
        execSync(`ffmpeg -i "${filePath}" -vf "scale=max(300\\,iw):-1" "${resizedPath}" -y 2>&1`);
        // 用缩放后的图片构造URL
        const resizedFileName = resizedPath.split('/').pop();
        imageUrl = `${domain.replace(/\/$/, '')}/uploads/${resizedFileName}`;
        
        console.log(`[图片上传] 保存到: ${filePath}`);
        console.log(`[图片上传] 缩放后URL: ${imageUrl}`);
      } catch (err) {
        console.error("[图片上传] 失败:", err);
        throw new Error("图片处理失败: " + String(err));
      }
    }
    console.log(`[数字人] 使用图片URL: ${imageUrl}`);
    // ========== END ==========

    console.log(`[数字人] 开始生成，文案长度: ${script.length}`);

    // 预估秒数
    const estimatedSeconds = Math.ceil(script.length / 4.5);

    // 余额检查
    const user = await prisma.user.findUnique({ where: { id: userInfo.userId } });
    if (!user || user.seconds < estimatedSeconds) {
      return NextResponse.json({
        success: false,
        error: `余额不足，需要 ${estimatedSeconds} 秒，当前剩余 ${user?.seconds || 0} 秒，请先充值`
      }, { status: 400 });
    }

    // ==========================================
    // 第一步：生成 TTS 音频
    // ==========================================
    console.log("[数字人] 步骤1: TTS音频已准备好");
    const audioPath = await generateTTS(script, voiceStyle);

    const audioFileName = `audio_${Date.now()}.mp3`;
    const audioUploadDir = join(process.cwd(), 'public', 'uploads');
    const audioPublicPath = join(audioUploadDir, audioFileName);
    copyFileSync(audioPath, audioPublicPath);
    const audioUrl = `${process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000'}/uploads/${audioFileName}`;
    console.log(`[数字人] 音频已生成，使用公网URL: ${audioUrl}，预估时长: ${estimatedSeconds}秒`);

    // ==========================================
    // 第二步：主体识别
    // ==========================================
    console.log("[数字人] 步骤2: 主体识别...");
    const personDetectResult = await callVolcengineAPI(
      "CVSubmitTask",
      "jimeng_realman_avatar_picture_create_role_omni_v15",
      {
        image_url: imageUrl,
      }
    );

    console.log("[数字人] 主体识别返回:", JSON.stringify(personDetectResult));

    // 火山引擎返回格式: data.task_id
    const taskIdStep2 = personDetectResult.data?.task_id;
    if (!taskIdStep2) {
      console.log("[数字人] 主体识别返回完整内容:", personDetectResult);
      throw new Error(`主体识别失败：未获取到任务ID, result=${JSON.stringify(personDetectResult.data)}`);
    }
    console.log("[数字人] 主体识别任务已提交:", taskIdStep2);

    // 轮询等待主体识别完成
    console.log("[数字人] 等待主体识别完成...");
    await new Promise(resolve => setTimeout(resolve, 3000)); // 等待3秒
    
    const detectCheckResult = await callVolcengineAPI(
      "CVGetResult",
      "jimeng_realman_avatar_picture_create_role_omni_v15",
      {
        task_id: taskIdStep2,
      }
    );

    console.log("[数字人] 主体识别查询返回:", JSON.stringify(detectCheckResult));

    const respData = detectCheckResult.data?.resp_data;
    let roleId = null;
    if (respData) {
      try {
        const parsed = JSON.parse(respData);
        if (parsed.status === 1) {
          roleId = parsed.role_id;
          console.log("[数字人] 主体识别完成, role_id:", roleId);
        } else {
          console.log("[数字人] 主体识别结果: 不包含人/类人主体");
        }
      } catch (e) {
        console.log("[数字人] 解析识别结果失败");
      }
    }

    // ==========================================
    // 第三步：提交视频生成任务
    // ==========================================
    console.log("[数字人] 步骤3: 提交 OmniHuman 1.5 视频生成任务...");
    
    const videoPayload: Record<string, any> = {
      req_key: "jimeng_realman_avatar_picture_omni_v15",
      task_name: "OmniHuman1.5_video",
      image_url: imageUrl,
      audio_url: audioUrl,
      output_resolution: aspectRatio === "9:16" ? 720 : 1080,
    };

    // 如果有 role_id，添加到请求中
    if (roleId) {
      videoPayload.role_id = roleId;
    }

    // 如果有提示词，添加到请求中
    // 动作风格转为 prompt
    const motionConfig = MOTION_STYLES[motionStyle];
    if (motionConfig && !prompt) {
      // 用户没有自定义 prompt 时，使用风格预设
      videoPayload.prompt = motionConfig.prompt;
    }

    if (prompt && prompt.trim()) {
      videoPayload.prompt = prompt.trim();
    }

    const videoResult = await callVolcengineAPI(
      "CVSubmitTask",
      "jimeng_realman_avatar_picture_omni_v15",
      videoPayload
    );

    const taskId = videoResult.data?.task_id;
    if (!taskId) {
      console.log("[数字人] 视频生成提交返回:", JSON.stringify(videoResult));
      throw new Error("视频生成任务提交失败：未获取到任务ID");
    }

    console.log(`[数字人] 视频生成任务已提交: ${taskId}`);

    // ==========================================
    // 扣费和记录
    // ==========================================
    await prisma.user.update({
      where: { id: userInfo.userId },
      data: { seconds: { decrement: estimatedSeconds } }
    });
    await prisma.video.create({
      data: {
        userId: userInfo.userId,
        taskId: taskId,
        duration: estimatedSeconds,
        status: "processing"
      }
    });

    // ==========================================
    // 返回任务信息
    // ==========================================

    // 异步清理1小时前的上传文件（不阻塞主流程）
    setTimeout(async () => {
      try {
        const { readdirSync, statSync, unlinkSync } = await import('fs');
        const uploadDir = join(process.cwd(), 'public', 'uploads');
        const files = readdirSync(uploadDir);
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        files.forEach(file => {
          const filePath = join(uploadDir, file);
          if (statSync(filePath).mtimeMs < oneHourAgo) {
            unlinkSync(filePath);
          }
        });
      } catch {}
    }, 0);

    return NextResponse.json({
      success: true,
      task_id: taskId,
      audio_duration: estimatedSeconds,
      status: "processing",
      message: "数字人视频生成任务已提交，请轮询查询状态",
      motion_tip: MOTION_STYLES[motionStyle]?.tip || null, // 给前端展示的拍摄建议
      remaining_seconds: user.seconds - estimatedSeconds,
    });
  } catch (error) {
    console.error("[数字人] 生成异常:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
