"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Zap, Clock, Crown } from "lucide-react";

interface Package {
  id: string;
  name: string;
  seconds: number;
  price: number;
  icon: React.ReactNode;
  description: string;
}

const packages: Package[] = [
  {
    id: "60",
    name: "体验包",
    seconds: 60,
    price: 90,
    icon: <Zap className="w-6 h-6" />,
    description: "适合首次体验"
  },
  {
    id: "300",
    name: "基础包",
    seconds: 300,
    price: 450,
    icon: <Clock className="w-6 h-6" />,
    description: "适合日常创作"
  },
  {
    id: "1200",
    name: "专业包",
    seconds: 1200,
    price: 1800,
    icon: <Crown className="w-6 h-6" />,
    description: "适合长期使用"
  }
];

export default function RechargePage() {
  const router = useRouter();
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [transferNo, setTransferNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderId, setOrderId] = useState("");

  // 提交充值申请
  const submitOrder = async () => {
    if (!selectedPackage) {
      toast.error("请选择套餐");
      return;
    }

    if (!transferNo.trim()) {
      toast.error("请输入转账单号");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/pay/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seconds: selectedPackage.seconds,
          transferNo: transferNo.trim()
        })
      });
      const data = await res.json();

      if (data.success) {
        setSubmitted(true);
        setOrderId(data.orderId);
        toast.success("充值申请已提交");
      } else {
        toast.error(data.error || "提交失败");
      }
    } catch (error) {
      toast.error("提交失败");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-xl">提交成功</CardTitle>
            <CardDescription>审核中，通常1小时内到账</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">套餐</span>
                <span className="font-medium">{selectedPackage?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">金额</span>
                <span className="font-medium">¥{selectedPackage?.price}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">时长</span>
                <span className="font-medium">{selectedPackage?.seconds} 秒</span>
              </div>
            </div>
            <Button onClick={() => router.push("/")} className="w-full">
              返回首页
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* 标题 */}
        <div className="text-center py-6">
          <h1 className="text-2xl font-bold">充值时长</h1>
          <p className="text-gray-500 mt-1">1.5元 / 秒</p>
        </div>

        {/* 套餐选择 */}
        <div className="grid grid-cols-3 gap-4">
          {packages.map((pkg) => (
            <Card
              key={pkg.id}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                selectedPackage?.id === pkg.id
                  ? "ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-900/20"
                  : ""
              }`}
              onClick={() => setSelectedPackage(pkg)}
            >
              <CardContent className="pt-6 text-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${
                  selectedPackage?.id === pkg.id
                    ? "bg-purple-500 text-white"
                    : "bg-gray-100 dark:bg-gray-800"
                }`}>
                  {pkg.icon}
                </div>
                <div className="font-bold text-lg">¥{pkg.price}</div>
                <div className="text-sm text-gray-500">{pkg.seconds} 秒</div>
                <div className="text-xs text-gray-400 mt-1">{pkg.name}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 支付说明 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">支付方式</CardTitle>
            <CardDescription>支付宝转账</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 二维码 */}
            <div className="flex justify-center">
              <div className="bg-white p-4 rounded-lg border-2 border-dashed">
                <img src="/alipay-qrcode.jpg" alt="支付宝收款码" className="w-full h-full object-contain" />
                <p className="text-center text-sm text-gray-500 mt-2">请扫码转账</p>
              </div>
            </div>

            {/* 金额提示 */}
            {selectedPackage && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 text-center">
                <p className="text-yellow-800 dark:text-yellow-200">
                  转账金额：<span className="font-bold text-xl">¥{selectedPackage.price}</span>
                </p>
                <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                  备注：您的手机号
                </p>
              </div>
            )}

            {/* 转账单号 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">转账单号</label>
              <Input
                placeholder="请输入支付宝转账单号"
                value={transferNo}
                onChange={(e) => setTransferNo(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                在支付宝转账记录中查看转账单号
              </p>
            </div>

            {/* 提交按钮 */}
            <Button
              onClick={submitOrder}
              disabled={!selectedPackage || !transferNo.trim() || loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  提交中...
                </>
              ) : (
                "提交充值申请"
              )}
            </Button>

            {/* 提示 */}
            <p className="text-xs text-gray-500 text-center">
              提交后请等待管理员审核，通常1小时内到账
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
