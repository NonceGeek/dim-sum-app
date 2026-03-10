import { NextRequest, NextResponse } from "next/server";
import { UserStatus } from "@prisma/client";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    // 验证用户登录状态
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    // 获取当前用户
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        status: true,
        deletionRequestedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    // 检查账号状态
    if (user.status !== UserStatus.PENDING_DELETE) {
      return NextResponse.json(
        { error: "账号未在注销流程中" },
        { status: 400 }
      );
    }

    // 撤销注销：恢复账号状态
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        status: UserStatus.ACTIVE,
        deletionRequestedAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "注销申请已撤销，账号已恢复正常",
    });
  } catch (error) {
    console.error("Cancel deletion error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
