import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

export async function POST(request: NextRequest) {
  try {
    const { orderId, action, note } = await request.json();

    // 验证管理员密码
    const authHeader = request.headers.get("authorization");
    const password = authHeader?.replace("Bearer ", "") || "";

    if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
      return NextResponse.json({ success: false, error: "密码错误" }, { status: 401 });
    }

    if (!orderId || !action) {
      return NextResponse.json({ success: false, error: "参数不完整" }, { status: 400 });
    }

    // 查找订单
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true }
    });

    if (!order) {
      return NextResponse.json({ success: false, error: "订单不存在" }, { status: 404 });
    }

    if (order.status !== "pending") {
      return NextResponse.json({ success: false, error: "订单已处理" }, { status: 400 });
    }

    if (action === "confirm") {
      // 确认订单，给用户加时长
      await prisma.$transaction([
        prisma.order.update({
          where: { id: orderId },
          data: { status: "confirmed", note: note || "审核通过" }
        }),
        prisma.user.update({
          where: { id: order.userId },
          data: { seconds: { increment: order.seconds } }
        })
      ]);

      console.log(`[充值确认] 订单:${orderId} 用户:${order.user.phone} 到账:${order.seconds}秒`);

      return NextResponse.json({
        success: true,
        message: `已确认，${order.user.phone} 到账 ${order.seconds} 秒`
      });

    } else if (action === "reject") {
      // 拒绝订单
      await prisma.order.update({
        where: { id: orderId },
        data: { status: "rejected", note: note || "审核拒绝" }
      });

      console.log(`[充值拒绝] 订单:${orderId} 原因:${note || "审核拒绝"}`);

      return NextResponse.json({
        success: true,
        message: "已拒绝"
      });

    } else {
      return NextResponse.json({ success: false, error: "无效操作" }, { status: 400 });
    }

  } catch (error) {
    console.error("[充值确认] 失败:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
