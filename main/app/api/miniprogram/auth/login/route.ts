import { NextRequest, NextResponse } from "next/server";
import {
  generateMiniprogramToken,
  generateRefreshToken,
} from "@/lib/miniprogram-jwt";
import { getUserCorpusList } from "@/lib/permission";
import { AliyunSmsService } from "@/lib/services/aliyun-sms";
import { prisma } from "@/lib/prisma";

interface WeChatAuthResponse {
  openid: string;
  session_key: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

/**
 * Miniprogram login endpoint
 * POST /api/miniprogram/auth/login
 *
 * Supports two login methods:
 * 1. WeChat login:
 *    - code: WeChat login code from wx.login()
 *
 * 2. Phone login:
 *    - phoneNumber: User's phone number
 *    - verificationCode: SMS verification code
 *
 * Response:
 * - accessToken: JWT token for API access (7 days)
 * - refreshToken: Token for refreshing access token (30 days)
 * - user: User information
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, phoneNumber, verificationCode } = body;

    // Determine login method
    if (phoneNumber && verificationCode) {
      // Phone + verification code login
      return await handlePhoneLogin(phoneNumber, verificationCode);
    } else if (code) {
      // WeChat code login
      return await handleWeChatLogin(code);
    } else {
      return NextResponse.json(
        { error: "Missing required parameters. Provide either 'code' for WeChat login, or 'phoneNumber' and 'verificationCode' for phone login." },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Miniprogram login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Handle phone + verification code login
 */
async function handlePhoneLogin(phoneNumber: string, verificationCode: string) {
  // 格式化手机号
  const formattedPhone = AliyunSmsService.formatPhoneNumber(phoneNumber);

  if (!AliyunSmsService.isValidPhoneNumber(formattedPhone)) {
    return NextResponse.json(
      { error: "手机号格式不正确" },
      { status: 400 },
    );
  }

  // 验证验证码
  const verificationToken = await prisma.verificationToken.findFirst({
    where: {
      identifier: formattedPhone,
      token: verificationCode,
      expires: {
        gt: new Date(),
      },
    },
  });

  if (!verificationToken) {
    return NextResponse.json(
      { error: "验证码无效或已过期" },
      { status: 400 },
    );
  }

  // 查找用户（仅登录，不自动注册）
  const user = await prisma.user.findFirst({
    where: { phoneNumber: formattedPhone },
    select: {
      id: true,
      name: true,
      image: true,
      wechatAvatar: true,
      role: true,
      isSystemAdmin: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "用户不存在，请先通过 Web 端注册或使用微信登录" },
      { status: 404 },
    );
  }

  // 删除已使用的验证码
  await prisma.verificationToken.delete({
    where: {
      identifier_token: {
        identifier: formattedPhone,
        token: verificationCode,
      },
    },
  });

  // Generate tokens
  const tokenPayload = {
    userId: user.id,
    phoneNumber: formattedPhone,
    role: user.role,
    isSystemAdmin: user.isSystemAdmin,
  };

  const accessToken = await generateMiniprogramToken(tokenPayload);
  const refreshToken = await generateRefreshToken(tokenPayload);

  // Get user corpus permissions
  const allowedCorpora = await getUserCorpusList(user.id);

  return NextResponse.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      avatar: user.wechatAvatar || user.image,
      role: user.role,
      isSystemAdmin: user.isSystemAdmin,
    },
    allowedCorpora: allowedCorpora,
  });
}

/**
 * Handle WeChat code login (existing flow)
 */
async function handleWeChatLogin(code: string) {
  // Exchange code for openid and session_key from WeChat
  const appId = process.env.WECHAT_MINIPROGRAM_APPID;
  const appSecret = process.env.WECHAT_MINIPROGRAM_SECRET;

  if (!appId || !appSecret) {
    console.error("Missing WeChat miniprogram configuration");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  // Call WeChat API to get openid
  const wechatResponse = await fetch(
    `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`,
  );

  const wechatData: WeChatAuthResponse = await wechatResponse.json();

  if (wechatData.errcode) {
    console.error("WeChat API error:", wechatData);
    return NextResponse.json(
      {
        error: "Failed to authenticate with WeChat",
        details: wechatData.errmsg,
      },
      { status: 400 },
    );
  }

  const { openid, unionid } = wechatData;

  // unionid is required for login
  if (!unionid) {
    return NextResponse.json(
      {
        error:
          "unionid is required. Please ensure your WeChat account is bound to the open platform.",
      },
      { status: 400 },
    );
  }

  // Find user by unionId
  const account = await prisma.account.findFirst({
    where: {
      unionId: unionid,
      provider: "wechat",
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
          wechatAvatar: true,
          role: true,
          isSystemAdmin: true,
        },
      },
    },
  });

  if (!account) {
    return NextResponse.json(
      {
        error: "User not found. Please register via web first or use phone login.",
        openid,
        unionid,
      },
      { status: 404 },
    );
  }

  const user = account.user;

  // Generate tokens
  const tokenPayload = {
    userId: user.id,
    openId: openid,
    unionId: unionid,
    role: user.role,
    isSystemAdmin: user.isSystemAdmin,
  };

  const accessToken = await generateMiniprogramToken(tokenPayload);
  const refreshToken = await generateRefreshToken(tokenPayload);

  // Get user corpus permissions
  const allowedCorpora = await getUserCorpusList(user.id);

  return NextResponse.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      avatar: user.wechatAvatar || user.image,
      role: user.role,
      isSystemAdmin: user.isSystemAdmin,
    },
    allowedCorpora: allowedCorpora,
  });
}

