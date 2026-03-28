import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

export async function POST(request: NextRequest) {
  try {
    const { password, count = 1 } = await request.json();
    if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
      return NextResponse.json({ success: false, error: "密码错误" }, { status: 401 });
    }
    const codes = [];
    for (let i = 0; i < Math.min(count, 50); i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      await prisma.inviteCode.create({ data: { code } });
      codes.push(code);
    }
    return NextResponse.json({ success: true, codes });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const password = request.nextUrl.searchParams.get("password");
    if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
      return NextResponse.json({ success: false, error: "密码错误" }, { status: 401 });
    }
    const codes = await prisma.inviteCode.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ success: true, codes });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
