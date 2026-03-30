"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Header } from "@/components/Header";
import {
  Upload, Music, Clock, Play, Download, X,
  Loader2, CheckCircle2, AlertCircle, GripVertical, Trash2, Film
} from "lucide-react";
import { toast } from "sonner";

interface ImageItem {
  id: string;
  file: File;
  preview: string;
}

const BGM_OPTIONS = [
  { id: "bgm1", name: "轻快活泼", icon: "🎵", gradient: "from-yellow-600 to-orange-600" },
  { id: "bgm2", name: "温柔舒缓", icon: "🎶", gradient: "from-pink-600 to-rose-600" },
  { id: "bgm3", name: "激情澎湃", icon: "🔥", gradient: "from-red-600 to-rose-700" },
];

const DURATION_OPTIONS = [
  { value: 2, label: "2秒" },
  { value: 3, label: "3秒" },
  { value: 5, label: "5秒" },
];

export default function MixPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedBgm, setSelectedBgm] = useState<string>("bgm1");
  const [duration, setDuration] = useState<number>(3);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultVideo, setResultVideo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 处理文件选择
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const newImages: ImageItem[] = [];

    for (const file of Array.from(files)) {
      if (!validTypes.includes(file.type)) {
        toast.error(`${file.name} 不是有效的图片格式`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} 超过10MB限制`);
        continue;
      }
      if (images.length + newImages.length >= 10) {
        toast.error("最多只能上传10张图片");
        break;
      }

      const preview = URL.createObjectURL(file);
      newImages.push({
        id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        file,
        preview,
      });
    }

    setImages(prev => [...prev, ...newImages]);
    toast.success(`已添加 ${newImages.length} 张图片`);
  }, [images.length]);

  // 删除图片
  const removeImage = useCallback((id: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter(i => i.id !== id);
    });
  }, []);

  // 拖拽排序
  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;

    setImages(prev => {
      const newImages = [...prev];
      const [draggedItem] = newImages.splice(dragItem.current!, 1);
      newImages.splice(dragOverItem.current!, 0, draggedItem);
      return newImages;
    });

    dragItem.current = null;
    dragOverItem.current = null;
  };

  // 生成视频
  const handleGenerate = async () => {
    if (images.length === 0) {
      toast.error("请上传至少1张图片");
      return;
    }

    setGenerating(true);
    setError(null);
    setProgress(0);
    setResultVideo(null);

    // 模拟进度
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 5, 90));
    }, 500);

    try {
      const formData = new FormData();
      for (const img of images) {
        formData.append("images", img.file);
      }
      formData.append("bgm", selectedBgm);
      formData.append("duration", duration.toString());

      const res = await fetch("/api/mix/generate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      clearInterval(progressInterval);

      if (!data.success) {
        throw new Error(data.error || "生成失败");
      }

      setProgress(100);
      setResultVideo(data.video_url);
      toast.success("视频生成成功！");
    } catch (err: any) {
      clearInterval(progressInterval);
      setError(err.message || "生成失败，请重试");
      toast.error(err.message || "生成失败");
    } finally {
      setGenerating(false);
    }
  };

  // 下载视频
  const handleDownload = () => {
    if (!resultVideo) return;
    const a = document.createElement("a");
    a.href = resultVideo;
    a.download = `混剪视频_${Date.now()}.mp4`;
    a.click();
  };

  // 重置
  const handleReset = () => {
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setImages([]);
    setResultVideo(null);
    setError(null);
    setProgress(0);
  };

  const totalDuration = images.length * duration;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Header 
        title="图片混剪" 
        subtitle="多图一键合成短视频"
        gradient="from-orange-600 to-amber-600"
      />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {/* 左侧：上传和设置 */}
            <div className="space-y-6">
              {/* 图片上传 */}
              <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Upload className="h-5 w-5" />
                    上传图片
                  </CardTitle>
                  <CardDescription className="text-white/50">支持 JPG/PNG/WebP，最多10张，可拖拽排序</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 上传区域 */}
                  <div
                    className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-white/40 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={generating}
                    />
                    <Upload className="h-12 w-12 mx-auto text-white/40 mb-4" />
                    <p className="text-white/60">点击或拖拽图片到此处上传</p>
                    <p className="text-sm text-white/40 mt-2">已上传 {images.length}/10 张</p>
                  </div>

                  {/* 图片预览列表 */}
                  {images.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white">图片顺序（拖拽调整）</span>
                        <Button variant="ghost" size="sm" onClick={handleReset} className="text-white/60 hover:text-white">
                          清空全部
                        </Button>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {images.map((img, index) => (
                          <div
                            key={img.id}
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragEnter={() => handleDragEnter(index)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                            className={`relative aspect-square rounded-lg overflow-hidden border-2 ${
                              dragOverItem.current === index ? "border-orange-500" : "border-transparent"
                            } cursor-grab active:cursor-grabbing group`}
                          >
                            <img
                              src={img.preview}
                              alt={`图片 ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1.5 rounded">
                              {index + 1}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeImage(img.id);
                              }}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-xs p-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <GripVertical className="h-3 w-3" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* BGM 选择 */}
              <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Music className="h-5 w-5" />
                    选择背景音乐
                  </CardTitle>
                  <CardDescription className="text-white/50">为视频选择合适的背景音乐</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    {BGM_OPTIONS.map((bgm) => (
                      <div
                        key={bgm.id}
                        onClick={() => setSelectedBgm(bgm.id)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all text-center ${
                          selectedBgm === bgm.id
                            ? "border-orange-500 bg-orange-500/10"
                            : "border-white/10 hover:border-white/30"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${bgm.gradient} flex items-center justify-center mx-auto mb-2`}>
                          <span className="text-xl">{bgm.icon}</span>
                        </div>
                        <div className="text-sm font-medium text-white">{bgm.name}</div>
                        {selectedBgm === bgm.id && (
                          <CheckCircle2 className="h-4 w-4 mx-auto mt-1 text-orange-500" />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 时长设置 */}
              <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Clock className="h-5 w-5" />
                    每张图片显示时长
                  </CardTitle>
                  <CardDescription className="text-white/50">预计总时长：{totalDuration} 秒</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3">
                    {DURATION_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setDuration(opt.value)}
                        className={`flex-1 py-3 rounded-xl border-2 transition-all ${
                          duration === opt.value
                            ? "border-orange-500 bg-orange-500/10 text-orange-400"
                            : "border-white/10 hover:border-white/30 text-white"
                        }`}
                      >
                        <div className="font-medium">{opt.label}</div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 生成按钮 */}
              <Button
                className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 border-0"
                size="lg"
                onClick={handleGenerate}
                disabled={images.length === 0 || generating}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    生成中... {progress}%
                  </>
                ) : (
                  <>
                    <Film className="h-5 w-5 mr-2" />
                    生成视频
                  </>
                )}
              </Button>

              {/* 进度条 */}
              {generating && <Progress value={progress} className="h-1" />}

              {/* 错误提示 */}
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 text-red-400">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <p className="text-sm">{error}</p>
                </div>
              )}
            </div>

            {/* 右侧：预览 */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Play className="h-5 w-5" />
                  视频预览
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {resultVideo ? (
                  <>
                    <video
                      controls
                      autoPlay
                      src={resultVideo}
                      className="w-full rounded-lg bg-black aspect-[9/16]"
                    />
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1 border-white/20 text-white hover:bg-white/10"
                        onClick={handleDownload}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        下载视频
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 border-white/20 text-white hover:bg-white/10"
                        onClick={handleReset}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        重新制作
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-96 text-white/40 border-2 border-dashed border-white/10 rounded-xl">
                    <Film className="h-16 w-16 mb-4" />
                    <p>上传图片并选择设置后</p>
                    <p>点击&quot;生成视频&quot;开始制作</p>
                    {images.length > 0 && (
                      <Badge variant="outline" className="mt-4 border-white/20 text-white/60">
                        {images.length} 张图片 · {totalDuration} 秒
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
