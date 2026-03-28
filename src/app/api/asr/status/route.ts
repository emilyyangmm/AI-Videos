import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";

const TTS_APP_ID = process.env.VOLCENGINE_TTS_APP_ID || "";
const TTS_TOKEN = process.env.VOLCENGINE_TTS_TOKEN || "";

export async function GET(request: NextRequest) {
  try {
    const userInfo = getUserFromRequest(request);
    if (!userInfo) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const taskId = request.nextUrl.searchParams.get("taskId");
    if (!taskId) {
      return NextResponse.json({ success: false, error: "缺少taskId" }, { status: 400 });
    }

    console.log("[ASR] 查询任务:", taskId);

    const res = await fetch(
      `https://openspeech.bytedance.com/api/v1/vc/query?appid=${TTS_APP_ID}&id=${taskId}`,
      { headers: { "Authorization": `Bearer; ${TTS_TOKEN}` } }
    );

    const data = await res.json();
    console.log("[ASR] 查询结果:", data);

    if (data.code === 2000) {
      return NextResponse.json({ success: true, status: "processing" });
    }
    if (data.code !== 0) {
      throw new Error(`ASR查询失败: code=${data.code}, message=${data.message || JSON.stringify(data)}`);
    }

    // 拼接所有文字
    const text = data.utterances?.map((u: any) => u.text).join("") || "";
    return NextResponse.json({ success: true, status: "done", text });
  } catch (error) {
    console.error("[ASR] 查询错误:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
