import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { callGemini } from "@/lib/gemini";

// ============================================================
// TikHub API 配置（https://tikhub.io）
// 按量计费，有免费试用额度，不需要第三方账号
// 在 .env 里加：TIKHUB_API_KEY=你的key
// ============================================================
const TIKHUB_API_KEY = process.env.TIKHUB_API_KEY || "";
const TIKHUB_BASE = "https://api.tikhub.io";

// 从抖音链接提取sec_user_id
function extractSecUserId(url: string): string | null {
  // 格式1：https://www.douyin.com/user/MS4wLjABAAAAxxx
  const m1 = url.match(/douyin\.com\/user\/([A-Za-z0-9_-]+)/);
  if (m1) return m1[1];
  // 格式2：v.douyin.com/xxxxx 短链，需要先重定向（这里简化处理，直接返回null让前端提示）
  return null;
}

// 用TikHub获取博主信息
async function fetchAuthorBySecUserId(secUserId: string) {
  const res = await fetch(
    `${TIKHUB_BASE}/api/v1/douyin/app/v3/fetch_user_profile_by_sec_user_id?sec_user_id=${encodeURIComponent(secUserId)}`,
    {
      headers: { Authorization: `Bearer ${TIKHUB_API_KEY}` },
    }
  );
  if (!res.ok) throw new Error(`TikHub API 错误: ${res.status}`);
  const data = await res.json();
  const u = data?.data?.user;
  if (!u) throw new Error("未获取到博主信息");
  return {
    nickname: u.nickname || "未知博主",
    avatar: u.avatar_thumb?.url_list?.[0] || u.avatar_medium?.url_list?.[0] || "",
    followers: u.follower_count || 0,
    total_likes: u.total_favorited || 0,
    sec_user_id: secUserId,
  };
}

// 用TikHub获取博主视频列表
async function fetchAuthorVideos(secUserId: string, maxCount = 20) {
  const res = await fetch(
    `${TIKHUB_BASE}/api/v1/douyin/app/v3/fetch_user_post_videos?sec_user_id=${encodeURIComponent(secUserId)}&count=${maxCount}`,
    {
      headers: { Authorization: `Bearer ${TIKHUB_API_KEY}` },
    }
  );
  if (!res.ok) throw new Error(`TikHub API 错误: ${res.status}`);
  const data = await res.json();
  const aweme_list = data?.data?.aweme_list || [];

  return aweme_list.map((v: any) => ({
    id: v.aweme_id || "",
    title: v.desc || v.share_desc || "（无标题）",
    description: v.desc || "",
    cover: v.video?.cover?.url_list?.[0] || v.video?.dynamic_cover?.url_list?.[0] || "",
    play_count: v.statistics?.play_count || 0,
    like_count: v.statistics?.digg_count || 0,
    comment_count: v.statistics?.comment_count || 0,
    author: v.author?.nickname || "",
  }));
}

// Gemini改写
async function rewriteText(text: string): Promise<string> {
  const prompt = `请将以下抖音视频文案进行改写，保留核心内容和意思，但换一种表达方式，使其更加生动自然，避免与原文雷同。改写后的文案应该：
1. 保持原意不变
2. 语言更加流畅生动
3. 避免重复用词
4. 适合视频口播，口语化
5. 结尾加上引导互动的行动号召

原文：
${text}

请直接输出改写后的文案，不需要任何解释或标注：`;
  return await callGemini(prompt);
}

// ============================================================
// 没有TikHub Key时的 Mock 数据（用于测试）
// ============================================================
function getMockData(url: string) {
  return {
    author: {
      nickname: "测试博主（未配置TikHub Key）",
      avatar: "",
      followers: 12800,
      total_likes: 56000,
    },
    videos: Array.from({ length: 10 }, (_, i) => ({
      id: `mock_${i}`,
      title: `测试视频标题 ${i + 1} - 这是一条模拟的抖音视频`,
      description: i % 2 === 0
        ? `这是视频${i + 1}的描述文案，用于测试改写功能。内容关于${["美妆技巧", "职场干货", "美食探店", "健身打卡", "穿搭分享"][i % 5]}。`
        : "",
      cover: "",
      play_count: Math.floor(Math.random() * 500000) + 10000,
      like_count: Math.floor(Math.random() * 50000) + 500,
      comment_count: Math.floor(Math.random() * 5000) + 50,
      author: "测试博主",
    })),
  };
}

export async function POST(request: NextRequest) {
  try {
    const userInfo = getUserFromRequest(request);
    if (!userInfo) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    // ==================== action: fetch_author ====================
    if (action === "fetch_author") {
      const { url } = body;
      if (!url?.trim()) {
        return NextResponse.json({ success: false, error: "请输入博主链接" }, { status: 400 });
      }

      // 如果没有配置TikHub，返回mock数据
      if (!TIKHUB_API_KEY) {
        console.warn("[拉片] TIKHUB_API_KEY 未配置，返回Mock数据");
        const mock = getMockData(url);
        return NextResponse.json({ success: true, ...mock });
      }

      const secUserId = extractSecUserId(url);
      if (!secUserId) {
        return NextResponse.json({
          success: false,
          error: "无法解析博主ID，请使用完整的主页链接（如 https://www.douyin.com/user/xxxxx）"
        }, { status: 400 });
      }

      const [author, videos] = await Promise.all([
        fetchAuthorBySecUserId(secUserId),
        fetchAuthorVideos(secUserId, 20),
      ]);

      return NextResponse.json({ success: true, author, videos });
    }

    // ==================== action: rewrite ====================
    if (action === "rewrite") {
      const { text } = body;
      if (!text?.trim()) {
        return NextResponse.json({ success: false, error: "请输入要改写的文案" }, { status: 400 });
      }
      if (text.length > 3000) {
        return NextResponse.json({ success: false, error: "文案不能超过3000字" }, { status: 400 });
      }

      const rewrittenText = await rewriteText(text);
      return NextResponse.json({ success: true, rewritten_text: rewrittenText.trim() });
    }

    return NextResponse.json({ success: false, error: "未知的 action" }, { status: 400 });
  } catch (error: any) {
    console.error("[Rewrite API] 错误:", error);
    return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
}
