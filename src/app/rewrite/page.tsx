"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Header } from "@/components/Header";
import { toast } from "sonner";
import {
  Search, Play, TrendingUp, Copy, RefreshCw, CheckCircle2,
  Loader2, ArrowRight, Upload, Trash2, Download,
  Eye, Heart, MessageCircle, ChevronRight, Video, Sparkles
} from "lucide-react";

// 声音选项（复用数字人配置）
const VOICE_OPTIONS = [
  { id: "zh_female_vv_uranus_bigtts", name: "vivi 2.0", desc: "通用女声" },
  { id: "zh_female_xiaohe_uranus_bigtts", name: "小何", desc: "自然亲切" },
  { id: "zh_male_m191_uranus_bigtts", name: "云舟", desc: "成熟男声" },
  { id: "zh_male_taocheng_uranus_bigtts", name: "小天", desc: "阳光男声" },
  { id: "saturn_zh_female_cancan_tob", name: "知性灿灿", desc: "知性优雅" },
  { id: "saturn_zh_female_keainvsheng_tob", name: "可爱女生", desc: "活泼可爱" },
];

// 动作风格
const MOTION_STYLES = [
  { id: "friendly", title: "亲切聊天", icon: "😊" },
  { id: "professional", title: "专业讲解", icon: "👔" },
  { id: "shopping", title: "热情推荐", icon: "🎉" },
  { id: "excited", title: "激情促销", icon: "🔥" },
  { id: "gentle", title: "治愈温柔", icon: "🌸" },
  { id: "authority", title: "权威发布", icon: "🏛️" },
];

interface VideoItem {
  id: string;
  title: string;
  cover: string;
  play_count: number;
  like_count: number;
  comment_count: number;
  description: string;
  author: string;
}

interface AuthorInfo {
  nickname: string;
  avatar: string;
  followers: number;
  total_likes: number;
}

export default function RewritePage() {
  // 步骤：1=输入博主 2=选视频 3=改写 4=生成数字人
  const [step, setStep] = useState(1);

  // 步骤1：博主信息
  const [profileUrl, setProfileUrl] = useState("");
  const [loadingAuthor, setLoadingAuthor] = useState(false);
  const [authorInfo, setAuthorInfo] = useState<AuthorInfo | null>(null);
  const [videoList, setVideoList] = useState<VideoItem[]>([]);
  const [sortBy, setSortBy] = useState<"play" | "like">("play");

  // 步骤2：选中的视频文案
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [originalText, setOriginalText] = useState("");

  // 步骤3：改写
  const [rewriting, setRewriting] = useState(false);
  const [rewrittenText, setRewrittenText] = useState("");
  const [copied, setCopied] = useState(false);

  // 步骤4：数字人
  const [portraitImage, setPortraitImage] = useState<string | null>(null);
  const [voiceStyle, setVoiceStyle] = useState("zh_female_vv_uranus_bigtts");
  const [motionStyle, setMotionStyle] = useState("friendly");
  const [generatingDH, setGeneratingDH] = useState(false);
  const [dhTaskId, setDhTaskId] = useState<string | null>(null);
  const [dhVideo, setDhVideo] = useState<string | null>(null);
  const [dhProgress, setDhProgress] = useState(0);

  // 格式化数字
  const formatNum = (n: number) => {
    if (n >= 10000) return (n / 10000).toFixed(1) + "w";
    return n.toString();
  };

  // 拉取博主信息和视频列表
  const handleFetchAuthor = async () => {
    if (!profileUrl.trim()) {
      toast.error("请输入抖音博主链接");
      return;
    }
    setLoadingAuthor(true);
    setAuthorInfo(null);
    setVideoList([]);

    try {
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fetch_author", url: profileUrl }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "获取失败");

      setAuthorInfo(data.author);
      setVideoList(data.videos);
      setStep(2);
      toast.success(`成功获取 ${data.videos.length} 条视频`);
    } catch (err: any) {
      toast.error(err.message || "获取失败，请检查链接");
    } finally {
      setLoadingAuthor(false);
    }
  };

  // 选择视频，获取文案
  const handleSelectVideo = async (video: VideoItem) => {
    setSelectedVideo(video);
    setOriginalText(video.description || "");
    setRewrittenText("");
    setStep(3);
  };

  // 排序后的视频列表
  const sortedVideos = [...videoList].sort((a, b) =>
    sortBy === "play" ? b.play_count - a.play_count : b.like_count - a.like_count
  );

  // Gemini改写
  const handleRewrite = async () => {
    if (!originalText.trim()) return;
    setRewriting(true);
    try {
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rewrite", text: originalText }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "改写失败");
      setRewrittenText(data.rewritten_text);
      toast.success("文案改写完成！");
    } catch (err: any) {
      toast.error(err.message || "改写失败");
    } finally {
      setRewriting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(rewrittenText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 轮询数字人状态
  const pollDHStatus = (taskId: string) => {
    const interval = setInterval(async () => {
      setDhProgress(p => Math.min(p + 3, 90));
      try {
        const res = await fetch(`/api/digital-human/status?taskId=${taskId}`);
        const data = await res.json();
        if ((data.status === "done" || data.status === "completed" || data.status === "success") && data.video_url) {
          clearInterval(interval);
          setDhVideo(data.video_url);
          setGeneratingDH(false);
          setDhProgress(100);
          toast.success("数字人视频生成完成！");
        } else if (data.status === "failed") {
          clearInterval(interval);
          setGeneratingDH(false);
          toast.error("数字人视频生成失败");
        }
      } catch {
        clearInterval(interval);
        setGeneratingDH(false);
      }
    }, 5000);
  };

  // 生成数字人
  const handleGenerateDH = async () => {
    const script = rewrittenText || originalText;
    if (!portraitImage || !script.trim()) {
      toast.error("请上传人像图片并确认文案");
      return;
    }

    setGeneratingDH(true);
    setDhVideo(null);
    setDhProgress(0);

    try {
      const res = await fetch("/api/digital-human/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portraitImage,
          script,
          voiceStyle,
          motionStyle,
          aspectRatio: "9:16",
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "提交失败");

      setDhTaskId(data.task_id);
      pollDHStatus(data.task_id);
      toast.success("数字人任务已提交，生成中...");
    } catch (err: any) {
      toast.error(err.message || "提交失败");
      setGeneratingDH(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Header
        title="抖音拉片"
        subtitle="博主爆款视频 → 改写文案 → 数字人"
        gradient="from-green-600 to-emerald-600"
      />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">

          {/* 步骤指示器 */}
          <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
            {[
              { label: "拉博主", icon: Search },
              { label: "选视频", icon: Play },
              { label: "改写文案", icon: Sparkles },
              { label: "生成数字人", icon: Video },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  onClick={() => i < step - 1 ? setStep(i + 1) : null}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    step === i + 1
                      ? "bg-green-500 text-white"
                      : step > i + 1
                      ? "bg-green-500/20 text-green-400 cursor-pointer hover:bg-green-500/30"
                      : "bg-white/5 text-white/30"
                  }`}
                >
                  {step > i + 1 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <s.icon className="w-3.5 h-3.5" />}
                  {s.label}
                </button>
                {i < 3 && <ChevronRight className="w-4 h-4 text-white/20" />}
              </div>
            ))}
          </div>

          {/* 步骤1：输入博主链接 */}
          {step === 1 && (
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Search className="w-5 h-5 text-green-400" />
                  第1步：输入抖音博主链接
                </CardTitle>
                <CardDescription className="text-white/50">
                  粘贴抖音博主主页链接，获取其热门视频列表
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Input
                    placeholder="粘贴抖音博主主页链接，例如：https://www.douyin.com/user/xxxxx"
                    value={profileUrl}
                    onChange={e => setProfileUrl(e.target.value)}
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/30 h-11"
                  />
                  <p className="text-xs text-white/30">
                    支持抖音博主主页链接，系统将自动获取视频列表及播放数据
                  </p>
                </div>

                <Button
                  onClick={handleFetchAuthor}
                  disabled={loadingAuthor}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 border-0 h-11"
                >
                  {loadingAuthor ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />获取中...</>
                  ) : (
                    <><Search className="w-4 h-4 mr-2" />获取博主视频</>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* 步骤2：选视频 */}
          {step === 2 && authorInfo && (
            <div className="space-y-4">
              {/* 博主信息卡 */}
              <Card className="bg-white/5 border-white/10">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-4">
                    <img src={authorInfo.avatar} alt="" className="w-14 h-14 rounded-full object-cover" />
                    <div className="flex-1">
                      <h3 className="text-white font-semibold text-lg">{authorInfo.nickname}</h3>
                      <div className="flex gap-4 mt-1 text-sm text-white/50">
                        <span>粉丝 {formatNum(authorInfo.followers)}</span>
                        <span>获赞 {formatNum(authorInfo.total_likes)}</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStep(1)}
                      className="border-white/20 text-white/60 hover:bg-white/10"
                    >
                      换博主
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 排序 + 视频列表 */}
              <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-base">
                      选择一个视频 <span className="text-white/40 text-sm font-normal">({videoList.length} 条)</span>
                    </CardTitle>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSortBy("play")}
                        className={`px-3 py-1 rounded-full text-xs border transition-all ${
                          sortBy === "play"
                            ? "border-green-500 bg-green-500/20 text-green-400"
                            : "border-white/15 text-white/40 hover:border-white/30"
                        }`}
                      >
                        <Eye className="w-3 h-3 inline mr-1" />播放量
                      </button>
                      <button
                        onClick={() => setSortBy("like")}
                        className={`px-3 py-1 rounded-full text-xs border transition-all ${
                          sortBy === "like"
                            ? "border-green-500 bg-green-500/20 text-green-400"
                            : "border-white/15 text-white/40 hover:border-white/30"
                        }`}
                      >
                        <Heart className="w-3 h-3 inline mr-1" />点赞量
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {sortedVideos.map((video, i) => (
                    <div
                      key={video.id}
                      onClick={() => handleSelectVideo(video)}
                      className="flex gap-3 p-3 rounded-xl border border-white/10 bg-white/3 hover:border-green-500/40 hover:bg-green-500/5 cursor-pointer transition-all group"
                    >
                      {/* 封面 */}
                      <div className="w-16 h-22 rounded-lg overflow-hidden shrink-0 bg-white/10 relative">
                        {video.cover ? (
                          <img src={video.cover} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play className="w-5 h-5 text-white/30" />
                          </div>
                        )}
                        <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1 rounded">
                          #{i + 1}
                        </div>
                      </div>
                      {/* 信息 */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium line-clamp-2 mb-2">{video.title || "（无标题）"}</p>
                        <div className="flex gap-3 text-xs text-white/40">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />{formatNum(video.play_count)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Heart className="w-3 h-3" />{formatNum(video.like_count)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="w-3 h-3" />{formatNum(video.comment_count)}
                          </span>
                        </div>
                        {video.description && (
                          <p className="text-white/30 text-xs mt-1 line-clamp-1">{video.description}</p>
                        )}
                      </div>
                      <div className="shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="w-4 h-4 text-green-400" />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {/* 步骤3：改写文案 */}
          {step === 3 && (
            <div className="space-y-4">
              {/* 选中视频信息 */}
              {selectedVideo && (
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-14 rounded-lg overflow-hidden bg-white/10 shrink-0">
                        {selectedVideo.cover && <img src={selectedVideo.cover} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium line-clamp-1">{selectedVideo.title || "所选视频"}</p>
                        <div className="flex gap-3 text-xs text-white/40 mt-1">
                          <span><Eye className="w-3 h-3 inline mr-0.5" />{formatNum(selectedVideo.play_count)}</span>
                          <span><Heart className="w-3 h-3 inline mr-0.5" />{formatNum(selectedVideo.like_count)}</span>
                        </div>
                      </div>
                      <button onClick={() => setStep(2)} className="text-xs text-white/40 hover:text-white">换视频</button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid lg:grid-cols-2 gap-4">
                {/* 原始文案 */}
                <Card className="bg-white/5 border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-white/60">原始文案</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={originalText}
                      onChange={e => setOriginalText(e.target.value)}
                      placeholder="视频文案/描述将显示在这里，也可手动输入..."
                      rows={10}
                      className="resize-none bg-white/5 border-white/20 text-white placeholder:text-white/30"
                    />
                    <p className="text-xs text-white/30 mt-2">{originalText.length} 字</p>
                  </CardContent>
                </Card>

                {/* 改写结果 */}
                <Card className="bg-white/5 border-white/10">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm text-white/60">改写后文案</CardTitle>
                      {rewrittenText && (
                        <button onClick={handleCopy} className="text-xs text-white/40 hover:text-white flex items-center gap-1">
                          {copied ? <><CheckCircle2 className="w-3 h-3 text-green-400" />已复制</> : <><Copy className="w-3 h-3" />复制</>}
                        </button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={rewrittenText}
                      onChange={e => setRewrittenText(e.target.value)}
                      placeholder="点击下方「Gemini改写」后显示结果..."
                      rows={10}
                      className="resize-none bg-white/5 border-white/20 text-white placeholder:text-white/30"
                    />
                    <p className="text-xs text-white/30 mt-2">{rewrittenText.length} 字</p>
                  </CardContent>
                </Card>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleRewrite}
                  disabled={rewriting || !originalText.trim()}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 border-0"
                >
                  {rewriting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />改写中...</>
                  ) : (
                    <><RefreshCw className="w-4 h-4 mr-2" />Gemini改写</>
                  )}
                </Button>
                <Button
                  onClick={() => setStep(4)}
                  disabled={!rewrittenText.trim() && !originalText.trim()}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 border-0"
                >
                  下一步：生成数字人
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* 步骤4：生成数字人 */}
          {step === 4 && (
            <div className="space-y-4">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Video className="w-5 h-5 text-green-400" />
                    第4步：生成数字人视频
                  </CardTitle>
                  <CardDescription className="text-white/50">
                    上传人像，选择声音和风格，即梦1.5生成数字人
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* 文案预览 */}
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-xs text-white/40 mb-1">使用文案（{(rewrittenText || originalText).length}字）</p>
                    <p className="text-sm text-white/80 line-clamp-3">{rewrittenText || originalText}</p>
                    <button onClick={() => setStep(3)} className="text-xs text-green-400 mt-1 hover:text-green-300">
                      修改文案
                    </button>
                  </div>

                  {/* 上传人像 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/80">上传人像图片</label>
                    <div className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center hover:border-white/40 transition-colors">
                      {portraitImage ? (
                        <div className="relative inline-block">
                          <img src={portraitImage} alt="人像" className="max-h-48 mx-auto rounded-lg" />
                          <button
                            onClick={() => setPortraitImage(null)}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                          >
                            <Trash2 className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer block">
                          <Upload className="w-8 h-8 mx-auto text-white/30 mb-2" />
                          <p className="text-sm text-white/40">点击上传人像图片</p>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = ev => setPortraitImage(ev.target?.result as string);
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* 声音选择 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/80">选择声音</label>
                    <div className="grid grid-cols-3 gap-2">
                      {VOICE_OPTIONS.map(v => (
                        <div
                          key={v.id}
                          onClick={() => setVoiceStyle(v.id)}
                          className={`p-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                            voiceStyle === v.id
                              ? "border-green-500 bg-green-500/10"
                              : "border-white/10 bg-white/5 hover:border-white/30"
                          }`}
                        >
                          <div className="text-sm font-medium text-white">{v.name}</div>
                          <div className="text-xs text-white/40">{v.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 动作风格 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/80">动作风格</label>
                    <div className="grid grid-cols-3 gap-2">
                      {MOTION_STYLES.map(m => (
                        <div
                          key={m.id}
                          onClick={() => setMotionStyle(m.id)}
                          className={`p-2.5 rounded-lg border-2 cursor-pointer transition-all text-center ${
                            motionStyle === m.id
                              ? "border-green-500 bg-green-500/10"
                              : "border-white/10 bg-white/5 hover:border-white/30"
                          }`}
                        >
                          <div className="text-xl mb-1">{m.icon}</div>
                          <div className="text-xs text-white">{m.title}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 生成按钮 */}
                  <Button
                    onClick={handleGenerateDH}
                    disabled={generatingDH || !portraitImage}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 border-0 h-11"
                  >
                    {generatingDH ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />生成中...</>
                    ) : (
                      <><Video className="w-4 h-4 mr-2" />生成数字人视频</>
                    )}
                  </Button>

                  {/* 生成进度 */}
                  {generatingDH && !dhVideo && (
                    <div className="p-4 rounded-xl bg-white/5 border border-green-500/20 text-center space-y-3">
                      <Loader2 className="w-8 h-8 mx-auto text-green-400 animate-spin" />
                      <p className="text-sm text-white/60">数字人生成中，通常需要 1~3 分钟...</p>
                      <Progress value={dhProgress} className="h-1" />
                    </div>
                  )}

                  {/* 生成结果 */}
                  {dhVideo && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-medium">数字人视频已生成！</span>
                      </div>
                      <div className="aspect-[9/16] max-w-xs mx-auto bg-black rounded-xl overflow-hidden">
                        <video src={dhVideo} controls className="w-full h-full" />
                      </div>
                      <a
                        href={dhVideo}
                        download
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-green-500/40 text-green-400 hover:bg-green-500/10 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        下载视频
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
