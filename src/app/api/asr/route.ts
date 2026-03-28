import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { join } from "path";

const TTS_APP_ID = process.env.VOLCENGINE_TTS_APP_ID || "";
const TTS_TOKEN = process.env.VOLCENGINE_TTS_TOKEN || "";

export async function POST(request: NextRequest) {
  try {
    const userInfo = getUserFromRequest(request);
    if (!userInfo) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ success: false, error: "请上传音频或视频文件" }, { status: 400 });
    }

    // 限制文件大小 100MB
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "文件不能超过100MB" }, { status: 400 });
    }

    // 保存文件到临时目录
    const buffer = Buffer.from(await file.arrayBuffer());
    const tmpDir = "/tmp/asr_uploads";
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
    const fileName = `asr_${Date.now()}_${file.name}`;
    const filePath = join(tmpDir, fileName);
    writeFileSync(filePath, buffer);

    // 构造公网可访问的URL（用项目域名）
    const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || "http://localhost:5000";

    // 先把文件复制到public目录让火山引擎能访问
    const publicDir = join(process.cwd(), "public", "uploads");
    if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });
    const publicFileName = `asr_${Date.now()}.${file.name.split(".").pop()}`;
    const publicPath = join(publicDir, publicFileName);
    writeFileSync(publicPath, buffer);
    const audioUrl = `${domain}/uploads/${publicFileName}`;

    console.log("[ASR] 提交音频:", audioUrl);

    // 提交 ASR 任务
    const submitRes = await fetch(
      `https://openspeech.bytedance.com/api/v1/vc/submit?appid=${TTS_APP_ID}&language=zh-CN&use_itn=True&use_punc=True&max_lines=1&words_per_line=15`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer; ${TTS_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ url: audioUrl }),
      }
    );

    const submitData = await submitRes.json();
    console.log("[ASR] 提交结果:", submitData);

    if (submitData.code !== 0) {
      // 清理上传的文件
      try {
        unlinkSync(publicPath);
      } catch (e) { /* ignore */ }
      throw new Error(`ASR提交失败: ${submitData.message || JSON.stringify(submitData)}`);
    }

    return NextResponse.json({ success: true, task_id: submitData.id });
  } catch (error) {
    console.error("[ASR] 提交错误:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
