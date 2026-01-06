import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, UserStatus } from "@prisma/client";
import { getAuthSession } from "@/lib/auth";

const prisma = new PrismaClient();

// 冷静期天数
const COOLING_PERIOD_DAYS = 7;

export async function POST(request: NextRequest) {
  try {
    // 验证用户登录状态
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { confirmPhrase } = await request.json();

    // 验证确认短语
    if (confirmPhrase !== "确认注销") {
      return NextResponse.json(
        { error: "请输入正确的确认短语" },
        { status: 400 }
      );
    }

    // 获取当前用户
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        status: true,
        deletionRequestedAt: true,
        email: true,
        phoneNumber: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    // 检查账号状态
    if (user.status === UserStatus.PENDING_DELETE) {
      return NextResponse.json(
        {
          error: "账号已在注销流程中",
          deletionDate: user.deletionRequestedAt
            ? new Date(
                user.deletionRequestedAt.getTime() +
                  COOLING_PERIOD_DAYS * 24 * 60 * 60 * 1000
              ).toISOString()
            : null,
        },
        { status: 400 }
      );
    }

    if (user.status === UserStatus.DELETED) {
      return NextResponse.json({ error: "账号已注销" }, { status: 400 });
    }

    const now = new Date();
    const deletionDate = new Date(
      now.getTime() + COOLING_PERIOD_DAYS * 24 * 60 * 60 * 1000
    );

    // 使用事务更新用户状态并删除所有会话
    await prisma.$transaction(async (tx) => {
      // 更新用户状态
      await tx.user.update({
        where: { id: session.user.id },
        data: {
          status: UserStatus.PENDING_DELETE,
          deletionRequestedAt: now,
        },
      });

      // 删除所有会话（登出所有设备）
      await tx.session.deleteMany({
        where: { userId: session.user.id },
      });
    });

    return NextResponse.json({
      success: true,
      message: "注销申请已提交",
      deletionDate: deletionDate.toISOString(),
      coolingPeriodDays: COOLING_PERIOD_DAYS,
      notice: `您的账号将在 ${COOLING_PERIOD_DAYS} 天后（${deletionDate.toLocaleDateString(
        "zh-CN"
      )}）被永久删除。在此期间您可以随时撤销注销申请。`,
    });
  } catch (error) {
    console.error("Request deletion error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// GET - 获取注销状态
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        status: true,
        deletionRequestedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    if (user.status !== UserStatus.PENDING_DELETE) {
      return NextResponse.json({
        isPendingDelete: false,
      });
    }

    const deletionDate = user.deletionRequestedAt
      ? new Date(
          user.deletionRequestedAt.getTime() +
            COOLING_PERIOD_DAYS * 24 * 60 * 60 * 1000
        )
      : null;

    return NextResponse.json({
      isPendingDelete: true,
      deletionRequestedAt: user.deletionRequestedAt?.toISOString(),
      deletionDate: deletionDate?.toISOString(),
      coolingPeriodDays: COOLING_PERIOD_DAYS,
    });
  } catch (error) {
    console.error("Get deletion status error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
