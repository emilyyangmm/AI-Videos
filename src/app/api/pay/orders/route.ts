import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
      return NextResponse.json({ success: false, error: "密码错误" }, { status: 401 });
    }

    // 获取所有待审核订单
    const orders = await prisma.order.findMany({
      where: { status: "pending" },
      include: {
        user: {
          select: { phone: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // 格式化返回数据
    const orderList = orders.map(order => ({
      id: order.id,
      phone: order.user.phone,
      seconds: order.seconds,
      amount: order.amount / 100, // 分转元
      transferNo: order.transferNo,
      createdAt: order.createdAt.toISOString()
    }));

    return NextResponse.json({
      success: true,
      orders: orderList,
      total: orderList.length
    });

  } catch (error) {
    console.error("[获取订单] 失败:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
