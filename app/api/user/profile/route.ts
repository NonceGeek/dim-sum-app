import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  return requireAuth(req, async (req, userId) => {
    // 获取用户资料
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phoneNumber: true,
        role: true,
      },
    });

    if (!user) {
      return new NextResponse(
        JSON.stringify({ error: "User not found" }),
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  });
}

export async function PUT(req: NextRequest) {
  return requireAuth(req, async (req, userId) => {
    const data = await req.json();

    // 验证更新数据
    const { name, phoneNumber } = data;
    
    // 更新用户资料
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        phoneNumber,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phoneNumber: true,
        role: true,
      },
    });

    return NextResponse.json(updatedUser);
  });
} 