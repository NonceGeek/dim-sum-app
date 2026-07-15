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

enum MiniprogramApp {
  ReviewApp = "review-app",
  YueCubeGame = "yue-cube-game",
  CorpusCollectionApp = "corpus-collection-app",
}

const DEFAULT_MINIPROGRAM_APP = MiniprogramApp.ReviewApp;

const MINIPROGRAM_CONFIGS: Record<
  MiniprogramApp,
  { appId: string | undefined; appSecret: string | undefined }
> = {
  [MiniprogramApp.ReviewApp]: {
    appId: process.env.WECHAT_MINIPROGRAM_APPID,
    appSecret: process.env.WECHAT_MINIPROGRAM_SECRET,
  },
  [MiniprogramApp.YueCubeGame]: {
    appId: process.env.WECHAT_MINIPROGRAM_YUE_CUBE_GAME_APPID,
    appSecret: process.env.WECHAT_MINIPROGRAM_YUE_CUBE_GAME_SECRET,
  },
  [MiniprogramApp.CorpusCollectionApp]: {
    appId: process.env.WECHAT_MINIPROGRAM_CORPUS_COLLECTION_APPID,
    appSecret: process.env.WECHAT_MINIPROGRAM_CORPUS_COLLECTION_SECRET,
  },
};

function isMiniprogramApp(value: unknown): value is MiniprogramApp {
  return (
    typeof value === "string" &&
    Object.values(MiniprogramApp).includes(value as MiniprogramApp)
  );
}

function getMiniprogramConfig(miniprogramApp: MiniprogramApp) {
  return MINIPROGRAM_CONFIGS[miniprogramApp];
}

/**
 * Miniprogram login endpoint
 * POST /api/miniprogram/auth/login
 *
 * Supports two login methods:
 * 1. WeChat login:
 *    - code: WeChat login code from wx.login()
 *    - miniprogramApp: optional app enum, defaults to "review-app"
 *    - Existing wechat account (matched by unionid) -> log in that user
 *    - Unknown unionid -> auto-create a new user (default LEARNER role) then log in
 *
 * 2. Phone login / free registration:
 *    - phoneNumber: User's phone number
 *    - verificationCode: SMS verification code
 *    - Existing phone (incl. phone bound to a WeChat account) -> log in that user
 *    - Unknown phone -> auto-create a new user (default LEARNER role) then log in
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
    const miniprogramApp = body.miniprogramApp ?? DEFAULT_MINIPROGRAM_APP;

    if (!isMiniprogramApp(miniprogramApp)) {
      return NextResponse.json(
        {
          error: "Invalid miniprogramApp",
          allowedValues: Object.values(MiniprogramApp),
        },
        { status: 400 },
      );
    }

    // Determine login method
    if (phoneNumber && verificationCode) {
      // Phone + verification code login
      return await handlePhoneLogin(phoneNumber, verificationCode);
    } else if (code) {
      // WeChat code login
      return await handleWeChatLogin(code, miniprogramApp);
    } else {
      return NextResponse.json(
        {
          error:
            "Missing required parameters. Provide either 'code' for WeChat login, or 'phoneNumber' and 'verificationCode' for phone login.",
        },
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

  // 查找用户。命中即登录：无论该手机号是手机注册产生的，
  // 还是已被某账号（如微信用户）绑定，都落在同一个 phoneNumber 字段上。
  const userSelect = {
    id: true,
    name: true,
    image: true,
    wechatAvatar: true,
    role: true,
    isSystemAdmin: true,
  } as const;

  let user = await prisma.user.findFirst({
    where: { phoneNumber: formattedPhone },
    select: userSelect,
  });

  // 未命中则自由注册：新建用户（默认 LEARNER 角色）并创建 SMS Account 记录，
  // 与 Web 端手机绑定流程 (/api/user/phone/bind) 保持一致。
  if (!user) {
    try {
      user = await prisma.user.create({
        data: {
          // 随机后缀，避免用手机号数字作为默认昵称（隐私）；用户可后续自行修改
          name: `用户_${Math.random().toString(36).slice(2, 8)}`,
          phoneNumber: formattedPhone,
          accounts: {
            create: {
              type: "credentials",
              provider: "sms",
              providerAccountId: formattedPhone,
            },
          },
        },
        select: userSelect,
      });
    } catch (createError) {
      // 并发注册时唯一约束可能冲突，回读一次已存在的用户
      user = await prisma.user.findFirst({
        where: { phoneNumber: formattedPhone },
        select: userSelect,
      });
      if (!user) {
        throw createError;
      }
    }
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
async function handleWeChatLogin(
  code: string,
  miniprogramApp: MiniprogramApp,
) {
  // Exchange code for openid and session_key from WeChat
  const { appId, appSecret } = getMiniprogramConfig(miniprogramApp);

  if (!appId || !appSecret) {
    console.error(
      "Missing WeChat miniprogram configuration:",
      miniprogramApp,
    );
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
  const userSelect = {
    id: true,
    name: true,
    image: true,
    wechatAvatar: true,
    role: true,
    isSystemAdmin: true,
  } as const;

  const account = await prisma.account.findFirst({
    where: {
      unionId: unionid,
      provider: "wechat",
    },
    include: {
      user: {
        select: userSelect,
      },
    },
  });

  let user = account?.user ?? null;

  // 未命中则自动注册：新建用户（默认 LEARNER 角色）并创建 wechat Account 记录，
  // 与 Web 端微信登录建号 (lib/auth.ts signIn callback) 保持一致。
  // 小程序 wx.login 拿不到昵称/头像，先用随机昵称，用户可后续自行修改。
  if (!user) {
    try {
      user = await prisma.user.create({
        data: {
          name: `用户_${Math.random().toString(36).slice(2, 8)}`,
          accounts: {
            create: {
              type: "oauth",
              provider: "wechat",
              providerAccountId: openid,
              openId: openid,
              unionId: unionid,
            },
          },
        },
        select: userSelect,
      });
    } catch (createError) {
      // 并发注册时唯一约束可能冲突，回读一次已存在的用户
      const existingAccount = await prisma.account.findFirst({
        where: {
          unionId: unionid,
          provider: "wechat",
        },
        include: {
          user: {
            select: userSelect,
          },
        },
      });
      user = existingAccount?.user ?? null;
      if (!user) {
        throw createError;
      }
    }
  }

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
