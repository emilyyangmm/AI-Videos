import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

// 有效套餐配置（秒数）
const VALID_SECONDS = [60, 300, 1200];
// 价格：1.5元/秒 = 150分/秒
const PRICE_PER_SECOND = 150;

export async function POST(request: NextRequest) {
  try {
    // 登录鉴权
    const userInfo = getUserFromRequest(request);
    if (!userInfo) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const { seconds, transferNo } = await request.json();

    // 参数验证
    if (!seconds || !transferNo) {
      return NextResponse.json({ success: false, error: "参数不完整" }, { status: 400 });
    }

    // 验证套餐
    if (!VALID_SECONDS.includes(seconds)) {
      return NextResponse.json({ success: false, error: "无效的套餐" }, { status: 400 });
    }

    // 计算金额（分）
    const amount = seconds * PRICE_PER_SECOND;

    // 创建订单
    const order = await prisma.order.create({
      data: {
        userId: userInfo.userId,
        seconds,
        amount,
        transferNo,
        status: "pending"
      }
    });

    console.log(`[充值申请] 用户:${userInfo.phone} 套餐:${seconds}秒 金额:${amount/100}元 单号:${transferNo}`);

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: amount / 100, // 转为元
      message: "充值申请已提交，请等待审核"
    });

  } catch (error) {
    console.error("[充值申请] 失败:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
