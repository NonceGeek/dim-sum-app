import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { generateMiniprogramToken, generateRefreshToken } from "@/lib/miniprogram-jwt";

const prisma = new PrismaClient();

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
 * Request body:
 * - code: WeChat login code from wx.login()
 *
 * Response:
 * - accessToken: JWT token for API access (7 days)
 * - refreshToken: Token for refreshing access token (30 days)
 * - user: User information
 */
export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();

    if (!code) {
      return NextResponse.json(
        { error: "Missing code parameter" },
        { status: 400 }
      );
    }

    // Exchange code for openid and session_key from WeChat
    const appId = process.env.WECHAT_MINIPROGRAM_APPID;
    const appSecret = process.env.WECHAT_MINIPROGRAM_SECRET;

    if (!appId || !appSecret) {
      console.error("Missing WeChat miniprogram configuration");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Call WeChat API to get openid
    const wechatResponse = await fetch(
      `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`
    );

    const wechatData: WeChatAuthResponse = await wechatResponse.json();

    if (wechatData.errcode) {
      console.error("WeChat API error:", wechatData);
      return NextResponse.json(
        { error: "Failed to authenticate with WeChat", details: wechatData.errmsg },
        { status: 400 }
      );
    }

    const { openid, unionid } = wechatData;

    // unionid is required for login
    if (!unionid) {
      return NextResponse.json(
        { error: "unionid is required. Please ensure your WeChat account is bound to the open platform." },
        { status: 400 }
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
          error: "User not found. Please register via web first.",
          openid,
          unionid
        },
        { status: 404 }
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
    });
  } catch (error) {
    console.error("Miniprogram login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
