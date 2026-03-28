import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET || "ai-videos-jwt-secret-2026";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, phone: true, seconds: true, createdAt: true }
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "用户不存在" }, { status: 404 });
    }

    return NextResponse.json({ success: true, user });
  } catch {
    return NextResponse.json({ success: false, error: "登录已过期" }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: "已退出登录" });
  response.cookies.delete("token");
  return response;
}
