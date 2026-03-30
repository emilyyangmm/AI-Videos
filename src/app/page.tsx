"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bot, ImageIcon, FileText, Film, Video, Sparkles,
  ArrowRight, Wallet, User, Zap
} from "lucide-react";

interface UserInfo {
  id: string;
  phone: string;
  seconds: number;
}

const FEATURES = [
  {
    id: "digital-human",
    icon: Bot,
    title: "数字人",
    desc: "上传照片生成专业口播视频",
    gradient: "from-purple-600 to-pink-600",
    href: "/digital-human"
  },
  {
    id: "image",
    icon: ImageIcon,
    title: "文生图/图生图",
    desc: "AI 一句话生成精美图片",
    gradient: "from-blue-600 to-cyan-600",
    href: "/image"
  },
  {
    id: "rewrite",
    icon: FileText,
    title: "文案提取",
    desc: "视频转文字一键洗稿改写",
    gradient: "from-green-600 to-emerald-600",
    href: "/rewrite"
  },
  {
    id: "mix",
    icon: Film,
    title: "图片混剪",
    desc: "多图一键合成短视频加BGM",
    gradient: "from-orange-600 to-amber-600",
    href: "/mix"
  },
  {
    id: "video-gen",
    icon: Video,
    title: "AI视频",
    desc: "文字或图片生成高质量视频",
    gradient: "from-red-600 to-rose-600",
    href: "/video-gen"
  }
];

export default function Home() {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.success) {
        setUserInfo(data.user);
      }
    } catch (error) {
      console.error("获取用户信息失败:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* 顶部导航 */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-white">AI Studio</span>
              </Link>
            </div>

            {/* 右侧 */}
            <div className="flex items-center gap-3">
              {loading ? (
                <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
              ) : userInfo ? (
                <>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                    <Wallet className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-medium text-white">{userInfo.seconds}秒</span>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => router.push("/recharge")}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 border-0"
                  >
                    充值
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => router.push("/login")}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 border-0"
                >
                  登录
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* 标题区域 */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-white/80">AI 驱动创作</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
              AI 创作工作台
            </h1>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              一站式 AI 内容创作平台，让创作更简单
            </p>
          </div>

          {/* 功能卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {FEATURES.map((feature) => (
              <Link key={feature.id} href={feature.href}>
                <Card className="group relative overflow-hidden bg-white/5 border-white/10 backdrop-blur-sm hover:scale-[1.02] transition-all duration-300 cursor-pointer min-h-[200px]">
                  {/* 渐变背景 */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 transition-opacity`} />
                  
                  {/* 边框发光效果 */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity blur-xl -z-10`} />

                  <div className="relative p-6 h-full flex flex-col">
                    {/* 图标 */}
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>

                    {/* 标题 */}
                    <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>

                    {/* 简介 */}
                    <p className="text-white/60 flex-1">{feature.desc}</p>

                    {/* 箭头 */}
                    <div className="flex items-center gap-2 text-white/40 group-hover:text-white transition-colors mt-4">
                      <span className="text-sm">立即体验</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* 底部提示 */}
          <div className="text-center mt-12">
            <Badge variant="outline" className="bg-white/5 border-white/20 text-white/80 px-4 py-2">
              <Sparkles className="w-4 h-4 mr-2 text-yellow-400" />
              新用户注册赠送 60 秒时长
            </Badge>
          </div>
        </div>
      </main>

      {/* 底部装饰 */}
      <div className="fixed bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50" />
    </div>
  );
}
