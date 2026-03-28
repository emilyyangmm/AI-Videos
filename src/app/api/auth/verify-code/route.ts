import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET || "ai-videos-jwt-secret-2026";

export async function POST(request: NextRequest) {
  try {
    const { phone, code, inviteCode } = await request.json();

    if (!phone || !code) {
      return NextResponse.json({ success: false, error: "参数不完整" }, { status: 400 });
    }

    const smsCode = await prisma.smsCode.findFirst({
      where: { phone, code, used: false, expiredAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" }
    });

    if (!smsCode) {
      return NextResponse.json({ success: false, error: "验证码错误或已过期" }, { status: 400 });
    }

    await prisma.smsCode.update({ where: { id: smsCode.id }, data: { used: true } });

    let user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      // 如果是新用户，必须验证邀请码
      const invite = await prisma.inviteCode.findUnique({ where: { code: inviteCode || "" } });
      if (!invite || invite.usedBy) {
        return NextResponse.json({ success: false, error: "邀请码无效或已被使用" }, { status: 400 });
      }
      // 创建用户
      user = await prisma.user.create({ data: { phone, seconds: 60 } });
      // 标记邀请码已使用
      await prisma.inviteCode.update({
        where: { code: inviteCode },
        data: { usedBy: phone, usedAt: new Date() }
      });
    }

    const token = jwt.sign({ userId: user.id, phone: user.phone }, JWT_SECRET, { expiresIn: "7d" });

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, phone: user.phone, seconds: user.seconds }
    });

    response.cookies.set("token", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60, path: "/" });

    return response;
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
