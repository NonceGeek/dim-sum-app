import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import {
  getAliyunSmsService,
  AliyunSmsService,
} from "@/lib/services/aliyun-sms";
import { prisma } from "@/lib/prisma";

// 生成6位数字验证码
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    // 验证用户登录状态
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { phoneNumber } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json({ error: "请输入手机号" }, { status: 400 });
    }

    // 格式化并验证手机号
    const formattedPhone = AliyunSmsService.formatPhoneNumber(phoneNumber);

    if (!AliyunSmsService.isValidPhoneNumber(formattedPhone)) {
      return NextResponse.json({ error: "手机号格式不正确" }, { status: 400 });
    }

    // 检查手机号是否已被其他用户绑定
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

    // 检查当前用户是否已绑定该手机号
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { phoneNumber: true },
    });

    if (currentUser?.phoneNumber === formattedPhone) {
      return NextResponse.json({ error: "您已绑定该手机号" }, { status: 400 });
    }

    // 检查是否频繁发送（60秒内）
    const recentToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: `bind:${formattedPhone}:${session.user.id}`,
        expires: {
          gt: new Date(Date.now() + 9 * 60 * 1000), // 距离过期还有9分钟以上（即发送不到1分钟）
        },
      },
    });

    if (recentToken) {
      return NextResponse.json(
        { error: "请稍后再试，验证码发送过于频繁" },
        { status: 429 }
      );
    }

    // 生成验证码
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分钟后过期

    // 删除旧的验证token（包含用户ID以区分绑定场景）
    await prisma.verificationToken.deleteMany({
      where: { identifier: `bind:${formattedPhone}:${session.user.id}` },
    });

    // 创建新的验证token
    await prisma.verificationToken.create({
      data: {
        identifier: `bind:${formattedPhone}:${session.user.id}`,
        token: verificationCode,
        expires: expiresAt,
      },
    });

    // 发送短信
    const smsService = getAliyunSmsService();
    const result = await smsService.sendSmsCode(
      formattedPhone,
      verificationCode
    );

    if (!result.success) {
      // 发送失败，删除验证token
      await prisma.verificationToken.deleteMany({
        where: { identifier: `bind:${formattedPhone}:${session.user.id}` },
      });

      return NextResponse.json(
        { error: result.message || "短信发送失败" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "验证码已发送",
      phoneNumber:
        formattedPhone.slice(0, 3) + "****" + formattedPhone.slice(-4),
    });
  } catch (error) {
    console.error("Send bind code error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
