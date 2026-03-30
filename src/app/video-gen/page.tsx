"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Video, Upload, Play, Download, Loader2,
  CheckCircle2, AlertCircle, Wand2, Image as ImageIcon
} from "lucide-react";
import { toast } from "sonner";

const MODE_OPTIONS = [
  { id: "t2v", name: "文生视频", icon: Wand2, desc: "输入文字描述生成视频" },
  { id: "i2v", name: "图生视频", icon: ImageIcon, desc: "上传图片让图片动起来" },
];

const DURATION_OPTIONS = [
  { value: 5, label: "5秒" },
  { value: 10, label: "10秒" },
];

const RATIO_OPTIONS = [
  { value: "16:9", label: "横屏 16:9", icon: "🖥️" },
  { value: "9:16", label: "竖屏 9:16", icon: "📱" },
  { value: "1:1", label: "方形 1:1", icon: "⬜" },
];

const RESOLUTION_OPTIONS = [
  { value: "720p", label: "720p" },
  { value: "1080p", label: "1080p" },
];

export default function VideoGenPage() {
  const router = useRouter();
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"t2v" | "i2v">("t2v");
  const [prompt, setPrompt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [duration, setDuration] = useState(5);
  const [ratio, setRatio] = useState("16:9");
  const [resolution, setResolution] = useState("720p");

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [resultVideo, setResultVideo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 处理图片选择
  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("请上传图片文件");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("图片不能超过5MB");
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError(null);
  }, []);

  // 生成视频
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("请输入视频描述");
      return;
    }
    if (prompt.length > 300) {
      toast.error("视频描述不能超过300字");
      return;
    }
    if (mode === "i2v" && !imageFile) {
      toast.error("请上传参考图片");
      return;
    }

    setGenerating(true);
    setError(null);
    setProgress(0);
    setResultVideo(null);

    try {
      let imageUrl = null;

      // 如果是图生视频模式，先上传图片
      if (mode === "i2v" && imageFile) {
        const uploadFormData = new FormData();
        uploadFormData.append("file", imageFile);

        const uploadRes = await fetch("/api/image/upload", {
          method: "POST",
          body: uploadFormData,
        });
        const uploadData = await uploadRes.json();

        if (!uploadData.success) {
          throw new Error(uploadData.error || "图片上传失败");
        }
        imageUrl = uploadData.url;
      }

      // 提交生成任务
      const res = await fetch("/api/video-gen/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          imageUrl,
          mode,
          resolution,
          duration,
          ratio,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "生成失败");
      }

      setTaskId(data.task_id);
      setProgress(10);

      // 开始轮询
      pollStatus(data.task_id);
    } catch (err: any) {
      setError(err.message || "生成失败");
      toast.error(err.message || "生成失败");
      setGenerating(false);
    }
  };

  // 轮询状态
  const pollStatus = async (id: string) => {
    const maxAttempts = 120; // 最多等待 6 分钟
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts++;
      setProgress(Math.min(10 + attempts * 0.8, 90));

      try {
        const res = await fetch(`/api/video-gen/status?taskId=${id}`);
        const data = await res.json();

        if (data.success) {
          if (data.status === "done") {
            clearInterval(interval);
            setResultVideo(data.video_url);
            setProgress(100);
            setGenerating(false);
            toast.success("视频生成成功！");
          } else if (data.status === "failed") {
            clearInterval(interval);
            setError(data.error || "生成失败");
            setGenerating(false);
            toast.error(data.error || "生成失败");
          }
          // else processing，继续轮询
        } else {
          throw new Error(data.error || "查询失败");
        }
      } catch (err: any) {
        clearInterval(interval);
        setError(err.message || "查询失败");
        setGenerating(false);
        toast.error(err.message || "查询失败");
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setError("生成超时，请重试");
        setGenerating(false);
        toast.error("生成超时，请重试");
      }
    }, 3000);
  };

  // 下载视频
  const handleDownload = () => {
    if (!resultVideo) return;
    const a = document.createElement("a");
    a.href = resultVideo;
    a.download = `AI视频_${Date.now()}.mp4`;
    a.click();
  };

  // 重置
  const handleReset = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setPrompt("");
    setResultVideo(null);
    setError(null);
    setProgress(0);
    setTaskId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">AI 视频生成</h1>
              <p className="text-sm text-slate-500">即梦文生视频 / 图生视频</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* 模式选择 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                选择生成模式
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {MODE_OPTIONS.map((opt) => (
                  <div
                    key={opt.id}
                    onClick={() => setMode(opt.id as "t2v" | "i2v")}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      mode === opt.id
                        ? "border-purple-500 bg-purple-50"
                        : "border-gray-200 hover:border-purple-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <opt.icon className="h-5 w-5" />
                      <span className="font-medium">{opt.name}</span>
                      {mode === opt.id && <CheckCircle2 className="h-4 w-4 text-purple-500 ml-auto" />}
                    </div>
                    <p className="text-xs text-slate-500">{opt.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 图生视频：图片上传 */}
          {mode === "i2v" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  上传参考图片
                </CardTitle>
                <CardDescription>上传一张图片，让它动起来（支持 JPG/PNG，最大5MB）</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  onClick={() => imageInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    imagePreview
                      ? "border-green-500 bg-green-50"
                      : "border-slate-300 hover:border-purple-400"
                  }`}
                >
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                    disabled={generating}
                  />
                  {imagePreview ? (
                    <div className="space-y-2">
                      <img
                        src={imagePreview}
                        alt="预览"
                        className="max-h-48 mx-auto rounded-lg object-contain"
                      />
                      <p className="text-sm text-green-600">点击更换图片</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-12 w-12 mx-auto text-slate-400" />
                      <p className="text-slate-600">点击上传图片</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 视频描述 */}
          <Card>
            <CardHeader>
              <CardTitle>视频描述</CardTitle>
              <CardDescription>描述你想要生成的视频内容，支持中文，300字以内</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="例如：一只橘色的猫咪在阳光下打盹，背景是开满鲜花的草地..."
                rows={4}
                maxLength={300}
                disabled={generating}
                className="resize-none"
              />
              <div className="flex justify-between text-sm text-slate-500">
                <span>提示：描述越具体，生成效果越好</span>
                <span>{prompt.length}/300</span>
              </div>
            </CardContent>
          </Card>

          {/* 参数设置 */}
          <Card>
            <CardHeader>
              <CardTitle>参数设置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 时长 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">视频时长</label>
                <div className="flex gap-3">
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setDuration(opt.value)}
                      disabled={generating}
                      className={`flex-1 py-2 rounded-lg border-2 transition-all ${
                        duration === opt.value
                          ? "border-purple-500 bg-purple-50 text-purple-700"
                          : "border-gray-200 hover:border-purple-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 比例 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">视频比例</label>
                <div className="grid grid-cols-3 gap-3">
                  {RATIO_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setRatio(opt.value)}
                      disabled={generating}
                      className={`py-3 rounded-lg border-2 transition-all ${
                        ratio === opt.value
                          ? "border-purple-500 bg-purple-50"
                          : "border-gray-200 hover:border-purple-300"
                      }`}
                    >
                      <div className="text-xl mb-1">{opt.icon}</div>
                      <div className="text-sm">{opt.label.split(" ")[0]}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 分辨率 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">分辨率</label>
                <div className="flex gap-3">
                  {RESOLUTION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setResolution(opt.value)}
                      disabled={generating}
                      className={`flex-1 py-2 rounded-lg border-2 transition-all ${
                        resolution === opt.value
                          ? "border-purple-500 bg-purple-50 text-purple-700"
                          : "border-gray-200 hover:border-purple-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 生成按钮 */}
          <Button
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            size="lg"
            onClick={handleGenerate}
            disabled={generating || !prompt.trim() || (mode === "i2v" && !imageFile)}
          >
            {generating ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                生成中... {progress}%
              </>
            ) : (
              <>
                <Video className="h-5 w-5 mr-2" />
                开始生成
              </>
            )}
          </Button>

          {/* 进度条 */}
          {generating && (
            <Progress value={progress} className="h-2" />
          )}

          {/* 错误提示 */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 text-red-700">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* 生成结果 */}
          {resultVideo && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  生成完成
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <video
                  src={resultVideo}
                  controls
                  className="w-full rounded-lg bg-black aspect-video"
                />
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    下载视频
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={handleReset}>
                    重新生成
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
