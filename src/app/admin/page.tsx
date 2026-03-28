"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Check, X, RefreshCw, Shield } from "lucide-react";

interface Order {
  id: string;
  phone: string;
  seconds: number;
  amount: number;
  transferNo: string;
  createdAt: string;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 获取订单列表
  const fetchOrders = async () => {
    if (!password.trim()) {
      toast.error("请输入管理员密码");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/pay/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();

      if (data.success) {
        setIsLoggedIn(true);
        setOrders(data.orders);
      } else {
        toast.error(data.error || "密码错误");
      }
    } catch (error) {
      toast.error("获取失败");
    } finally {
      setLoading(false);
    }
  };

  // 处理订单
  const handleOrder = async (orderId: string, action: "confirm" | "reject") => {
    setActionLoading(orderId);
    try {
      const res = await fetch("/api/pay/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${password}`
        },
        body: JSON.stringify({ orderId, action })
      });
      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        // 从列表中移除
        setOrders(orders.filter(o => o.id !== orderId));
      } else {
        toast.error(data.error || "操作失败");
      }
    } catch (error) {
      toast.error("操作失败");
    } finally {
      setActionLoading(null);
    }
  };

  // 登录界面
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-purple-600" />
            </div>
            <CardTitle className="text-xl">后台管理</CardTitle>
            <CardDescription>请输入管理员密码</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              placeholder="管理员密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchOrders()}
            />
            <Button onClick={fetchOrders} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  验证中...
                </>
              ) : (
                "进入后台"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 订单列表
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 标题栏 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">充值审核</h1>
            <p className="text-gray-500">待审核订单 {orders.length} 条</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsLoggedIn(false);
                setOrders([]);
                setPassword("");
              }}
            >
              退出
            </Button>
            <Button
              variant="outline"
              onClick={fetchOrders}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              刷新
            </Button>
          </div>
        </div>

        {/* 订单列表 */}
        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              暂无待审核订单
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    {/* 用户信息 */}
                    <div className="space-y-1">
                      <div className="font-medium text-lg">{order.phone}</div>
                      <div className="text-sm text-gray-500">
                        申请时间：{new Date(order.createdAt).toLocaleString("zh-CN")}
                      </div>
                      <div className="text-sm text-gray-500">
                        转账单号：{order.transferNo}
                      </div>
                    </div>

                    {/* 金额 */}
                    <div className="text-center px-6">
                      <div className="text-2xl font-bold text-green-600">
                        ¥{order.amount}
                      </div>
                      <div className="text-sm text-gray-500">
                        {order.seconds} 秒
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        onClick={() => handleOrder(order.id, "confirm")}
                        disabled={actionLoading === order.id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {actionLoading === order.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            通过
                          </>
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleOrder(order.id, "reject")}
                        disabled={actionLoading === order.id}
                      >
                        {actionLoading === order.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <X className="w-4 h-4 mr-2" />
                            拒绝
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
