import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { PrismaClient } from '@prisma/client';
import { VerificationEmail } from '@/components/email/verification-email';

const resend = new Resend(process.env.RESEND_API_KEY);
const prisma = new PrismaClient();

// 生成6位数字验证码
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const { email, role } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // 生成验证码
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分钟后过期

    // 删除旧的验证token
    await prisma.verificationToken.deleteMany({
      where: { identifier: email }
    });

    // 创建新的验证token
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: verificationCode,
        expires: expiresAt,
      }
    });

    const fromEmail = process.env.NODE_ENV === 'production'
      ? 'DimSum App <noreply@aidimsum.com>'
      : 'DimSum App <onboarding@resend.dev>'; // 开发环境使用Resend默认测试域名

    // 开发环境下，只允许向Resend注册邮箱发送
    const recipientEmail = process.env.NODE_ENV === 'production' 
      ? email 
      : (process.env.RESEND_REGISTERED_EMAIL || 'dimsumaiapp@gmail.com');

    // 发送验证邮件
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [recipientEmail],
      subject: 'Verify your email - DimSum App',
      react: VerificationEmail({ 
        verificationCode,
        userName: email.split('@')[0]
      }) as React.ReactElement,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json(
        { error: 'Failed to send verification email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verification email sent successfully',
      email: email
    });

  } catch (error) {
    console.error('Send verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 