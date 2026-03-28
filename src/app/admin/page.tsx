"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Check, X, RefreshCw, Shield, Gift, Copy, Trash2 } from "lucide-react";

interface Order {
  id: string;
  phone: string;
  seconds: number;
  amount: number;
  transferNo: string;
  createdAt: string;
}

interface InviteCode {
  id: string;
  code: string;
  usedBy: string | null;
  usedAt: string | null;
  createdAt: string;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [inviteCount, setInviteCount] = useState("10");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"orders" | "invites">("orders");

  // 获取订单列表
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pay/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();

      if (data.success) {
        setOrders(data.orders);
      } else {
        toast.error(data.error || "获取失败");
      }
    } catch (error) {
      toast.error("获取失败");
    } finally {
      setLoading(false);
    }
  };

  // 获取邀请码列表
  const fetchInviteCodes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/invite?password=${encodeURIComponent(password)}`);
      const data = await res.json();

      if (data.success) {
        setInviteCodes(data.codes);
      } else {
        toast.error(data.error || "获取失败");
      }
    } catch (error) {
      toast.error("获取失败");
    } finally {
      setLoading(false);
    }
  };

  // 生成邀请码
  const generateInviteCodes = async () => {
    const count = parseInt(inviteCount) || 10;
    if (count < 1 || count > 50) {
      toast.error("数量需在 1-50 之间");
      return;
    }

    setActionLoading("generate");
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, count })
      });
      const data = await res.json();

      if (data.success) {
        toast.success(`生成 ${data.codes.length} 个邀请码成功`);
        setInviteCodes([...data.codes.map((code: string) => ({
          id: code,
          code,
          usedBy: null,
          usedAt: null,
          createdAt: new Date().toISOString()
        })), ...inviteCodes]);
      } else {
        toast.error(data.error || "生成失败");
      }
    } catch (error) {
      toast.error("生成失败");
    } finally {
      setActionLoading(null);
    }
  };

  // 复制邀请码
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("已复制");
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

  // 登录
  const login = async () => {
    if (!password.trim()) {
      toast.error("请输入管理员密码");
      return;
    }

    setLoading(true);
    try {
      // 验证密码
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
      toast.error("验证失败");
    } finally {
      setLoading(false);
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
              onKeyDown={(e) => e.key === "Enter" && login()}
            />
            <Button onClick={login} disabled={loading} className="w-full">
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

  // 后台主界面
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 标题栏 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">后台管理</h1>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsLoggedIn(false);
                setOrders([]);
                setInviteCodes([]);
                setPassword("");
              }}
            >
              退出
            </Button>
          </div>
        </div>

        {/* Tab 切换 */}
        <div className="flex gap-2 border-b">
          <button
            onClick={() => { setActiveTab("orders"); if (orders.length === 0) fetchOrders(); }}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === "orders"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            充值审核 ({orders.length})
          </button>
          <button
            onClick={() => { setActiveTab("invites"); if (inviteCodes.length === 0) fetchInviteCodes(); }}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === "invites"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            邀请码管理
          </button>
        </div>

        {/* 充值审核 Tab */}
        {activeTab === "orders" && (
          <>
            <div className="flex justify-end">
              <Button variant="outline" onClick={fetchOrders} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                刷新
              </Button>
            </div>

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
                        <div className="space-y-1">
                          <div className="font-medium text-lg">{order.phone}</div>
                          <div className="text-sm text-gray-500">
                            申请时间：{new Date(order.createdAt).toLocaleString("zh-CN")}
                          </div>
                          <div className="text-sm text-gray-500">
                            转账单号：{order.transferNo}
                          </div>
                        </div>
                        <div className="text-center px-6">
                          <div className="text-2xl font-bold text-green-600">
                            ¥{order.amount}
                          </div>
                          <div className="text-sm text-gray-500">
                            {order.seconds} 秒
                          </div>
                        </div>
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
          </>
        )}

        {/* 邀请码管理 Tab */}
        {activeTab === "invites" && (
          <>
            {/* 生成邀请码 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Gift className="w-5 h-5" />
                  生成邀请码
                </CardTitle>
                <CardDescription>新用户需凭邀请码注册</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={inviteCount}
                    onChange={(e) => setInviteCount(e.target.value)}
                    className="w-24"
                    placeholder="数量"
                  />
                  <Button onClick={generateInviteCodes} disabled={actionLoading === "generate"}>
                    {actionLoading === "generate" ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Gift className="w-4 h-4 mr-2" />
                    )}
                    生成
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 邀请码列表 */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">邀请码列表</CardTitle>
                  <Button variant="outline" size="sm" onClick={fetchInviteCodes} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                    刷新
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {inviteCodes.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">暂无邀请码</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {inviteCodes.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border flex items-center justify-between ${
                          item.usedBy ? "bg-gray-50 text-gray-400" : "bg-green-50"
                        }`}
                      >
                        <div>
                          <div className="font-mono font-bold text-lg">{item.code}</div>
                          {item.usedBy ? (
                            <div className="text-xs text-gray-400">
                              已用 by {item.usedBy}
                            </div>
                          ) : (
                            <div className="text-xs text-green-600">未使用</div>
                          )}
                        </div>
                        {!item.usedBy && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyCode(item.code)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
