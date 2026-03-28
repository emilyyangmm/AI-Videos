"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Smartphone, Lock, Gift } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);

  // 发送验证码
  const sendCode = async () => {
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      toast.error("请输入正确的手机号");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();

      if (data.success) {
        toast.success("验证码已发送");
        setCodeSent(true);
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        toast.error(data.error || "发送失败");
      }
    } catch (error) {
      toast.error("发送失败");
    } finally {
      setLoading(false);
    }
  };

  // 登录
  const login = async () => {
    if (!phone || !code) {
      toast.error("请填写完整");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, inviteCode })
      });
      const data = await res.json();

      if (data.success) {
        toast.success("登录成功");
        router.push("/");
        router.refresh();
      } else {
        toast.error(data.error || "登录失败");
      }
    } catch (error) {
      toast.error("登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">AI 短视频生成</CardTitle>
          <CardDescription>登录后开始创作爆款短视频</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 手机号 */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              手机号
            </label>
            <div className="flex gap-2">
              <Input
                type="tel"
                placeholder="请输入手机号"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1"
                maxLength={11}
              />
              <Button
                variant="outline"
                onClick={sendCode}
                disabled={countdown > 0 || loading}
                className="whitespace-nowrap"
              >
                {countdown > 0 ? `${countdown}s` : "获取验证码"}
              </Button>
            </div>
          </div>

          {/* 验证码 */}
          {codeSent && (
            <div className="space-y-2 animate-in slide-in-from-top-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Lock className="w-4 h-4" />
                验证码
              </label>
              <Input
                type="text"
                placeholder="请输入验证码"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="text-center text-lg tracking-widest"
                maxLength={6}
              />
            </div>
          )}

          {/* 邀请码 */}
          {codeSent && (
            <div className="space-y-2 animate-in slide-in-from-top-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Gift className="w-4 h-4" />
                邀请码 <span className="text-gray-400 font-normal">(新用户必填)</span>
              </label>
              <Input
                type="text"
                placeholder="请输入邀请码"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="text-center tracking-widest"
                maxLength={10}
              />
            </div>
          )}

          {/* 登录按钮 */}
          <Button
            onClick={login}
            disabled={loading || !codeSent || code.length < 6}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                登录中...
              </>
            ) : (
              "登录"
            )}
          </Button>

          {/* 提示 */}
          <p className="text-xs text-gray-500 text-center">
            新用户需填写邀请码登录，送 60 秒免费时长
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
