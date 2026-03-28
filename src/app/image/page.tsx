"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Upload, X, Download, Image, Wand2 } from "lucide-react";

export default function ImagePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [prompt, setPrompt] = useState("");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // 处理图片上传
  const handleImageUpload = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("图片不能超过5MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("请上传图片文件");
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setReferenceImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // 删除参考图
  const removeImage = () => {
    setReferenceImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 拖拽处理
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  };

  // 生成图片
  const generate = async () => {
    if (!prompt.trim()) {
      toast.error("请输入图片描述");
      return;
    }

    setLoading(true);
    setImageUrl(null);

    try {
      const res = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, referenceImage }),
      });
      const data = await res.json();

      if (!data.success) {
        toast.error(data.error || "生成失败");
        setLoading(false);
        return;
      }

      setImageUrl(data.image_url);
      toast.success("图片生成成功！");

    } catch (error) {
      toast.error("生成失败");
    } finally {
      setLoading(false);
    }
  };

  // 下载图片
  const downloadImage = async () => {
    if (!imageUrl) return;
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `ai-image-${Date.now()}.png`;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      toast.error("下载失败");
    }
  };

  // 重置
  const reset = () => {
    setPrompt("");
    setReferenceImage(null);
    setImageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 标题 */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-3">
            <Wand2 className="w-8 h-8 text-purple-600" />
            AI 文生图 / 图生图
          </h1>
          <p className="text-gray-500">输入描述生成图片，或上传参考图生成同风格图片</p>
        </div>

        {/* 生成区域 */}
        <Card>
          <CardContent className="pt-6 space-y-6">
            {/* 参考图上传 */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Image className="w-4 h-4" />
                参考图（可选）
                <span className="text-gray-400 font-normal">上传参考图将使用图生图模式</span>
              </label>
              
              {referenceImage ? (
                <div className="relative inline-block">
                  <img
                    src={referenceImage}
                    alt="参考图"
                    className="max-h-48 rounded-lg border"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2 rounded-full w-8 h-8 p-0"
                    onClick={removeImage}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    dragOver
                      ? "border-purple-500 bg-purple-50"
                      : "border-gray-300 hover:border-purple-400"
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500">
                    点击或拖拽上传参考图（可选）
                  </p>
                  <p className="text-xs text-gray-400 mt-1">支持 JPG/PNG，最大5MB</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
              />
            </div>

            {/* 描述输入 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                图片描述 <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full h-32 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="描述你想要的图片，支持中文，例如：一只可爱的猫咪坐在樱花树下，春天氛围，动漫风格"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={300}
              />
              <div className="text-xs text-gray-400 text-right">
                {prompt.length}/300
              </div>
            </div>

            {/* 生成按钮 */}
            <div className="flex gap-3">
              <Button
                onClick={generate}
                disabled={loading || !prompt.trim()}
                className="flex-1"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    {referenceImage ? "图生图" : "文生图"}
                  </>
                )}
              </Button>
              {imageUrl && (
                <Button variant="outline" onClick={reset}>
                  重新生成
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 加载动画 */}
        {loading && (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-purple-600 animate-spin" />
              <p className="text-gray-500">AI 正在生成图片，请稍候...</p>
            </CardContent>
          </Card>
        )}

        {/* 生成的图片 */}
        {imageUrl && !loading && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">生成结果</CardTitle>
              <CardDescription>点击下载按钮保存图片</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative group">
                <img
                  src={imageUrl}
                  alt="生成的图片"
                  className="w-full rounded-lg"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute bottom-4 right-4"
                  onClick={downloadImage}
                >
                  <Download className="w-4 h-4 mr-1" />
                  下载
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
