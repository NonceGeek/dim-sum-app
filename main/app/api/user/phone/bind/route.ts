import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { AliyunSmsService } from "@/lib/services/aliyun-sms";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    // 验证用户登录状态
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { phoneNumber, code } = await request.json();

    if (!phoneNumber || !code) {
      return NextResponse.json(
        { error: "请输入手机号和验证码" },
        { status: 400 }
      );
    }

    // 格式化手机号
    const formattedPhone = AliyunSmsService.formatPhoneNumber(phoneNumber);

    if (!AliyunSmsService.isValidPhoneNumber(formattedPhone)) {
      return NextResponse.json({ error: "手机号格式不正确" }, { status: 400 });
    }

    // 验证验证码
    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: `bind:${formattedPhone}:${session.user.id}`,
        token: code,
        expires: {
          gt: new Date(),
        },
      },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { error: "验证码无效或已过期" },
        { status: 400 }
      );
    }

    // 再次检查手机号是否已被其他用户绑定（防止竞态条件）
    const existingUser = await prisma.user.findFirst({
      where: {
        phoneNumber: formattedPhone,
        id: { not: session.user.id },
      },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          error: "PHONE_ALREADY_BOUND",
          message: "该手机号已被其他账号使用",
        },
        { status: 409 }
      );
    }

    // 使用事务绑定手机号并删除验证码
    await prisma.$transaction(async (tx) => {
      // 绑定手机号到用户
      await tx.user.update({
        where: { id: session.user.id },
        data: { phoneNumber: formattedPhone },
      });

      // 删除已使用的验证码
      await tx.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: `bind:${formattedPhone}:${session.user.id}`,
            token: code,
          },
        },
      });

      // 创建 SMS Account 记录（用于短信登录）
      const existingAccount = await tx.account.findFirst({
        where: {
          userId: session.user.id,
          provider: "sms",
        },
      });

      if (!existingAccount) {
        await tx.account.create({
          data: {
            type: "credentials",
            provider: "sms",
            providerAccountId: formattedPhone,
            userId: session.user.id,
          },
        });
      } else {
        // 更新已有的 SMS Account 记录
        await tx.account.update({
          where: { id: existingAccount.id },
          data: { providerAccountId: formattedPhone },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: "手机号绑定成功",
      phoneNumber:
        formattedPhone.slice(0, 3) + "****" + formattedPhone.slice(-4),
    });
  } catch (error) {
    console.error("Bind phone error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
