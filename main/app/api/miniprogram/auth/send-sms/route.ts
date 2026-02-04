import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import {
  getAliyunSmsService,
  AliyunSmsService,
} from "@/lib/services/aliyun-sms";

const prisma = new PrismaClient();

// 生成6位数字验证码
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Miniprogram SMS verification code endpoint
 * POST /api/miniprogram/auth/send-sms
 *
 * Request body:
 * - phoneNumber: Phone number to send verification code to
 *
 * Response:
 * - success: Whether the code was sent successfully
 * - message: Result message
 * - phoneNumber: Masked phone number
 */
export async function POST(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json({ error: "请输入手机号" }, { status: 400 });
    }

    // 格式化并验证手机号
    const formattedPhone = AliyunSmsService.formatPhoneNumber(phoneNumber);

    if (!AliyunSmsService.isValidPhoneNumber(formattedPhone)) {
      return NextResponse.json({ error: "手机号格式不正确" }, { status: 400 });
    }

    // 检查是否频繁发送（60秒内）
    const recentToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: formattedPhone,
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

    // 删除旧的验证token
    await prisma.verificationToken.deleteMany({
      where: { identifier: formattedPhone },
    });

    // 创建新的验证token
    await prisma.verificationToken.create({
      data: {
        identifier: formattedPhone,
        token: verificationCode,
        expires: expiresAt,
      },
    });

    // 发送短信
    const smsService = getAliyunSmsService();
    const result = await smsService.sendSmsCode(formattedPhone, verificationCode);

    if (!result.success) {
      // 发送失败，删除验证token
      await prisma.verificationToken.deleteMany({
        where: { identifier: formattedPhone },
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
        formattedPhone.slice(0, 3) + "****" + formattedPhone.slice(-4), // 脱敏显示
    });
  } catch (error) {
    console.error("Miniprogram send SMS verification error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
