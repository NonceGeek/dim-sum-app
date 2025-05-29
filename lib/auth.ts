import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { AuthOptions } from "next-auth";
// import { JWT } from "next-auth/jwt";
// import { User } from "next-auth";
import WechatProvider from "@/providers/wechat";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 扩展 Profile 类型以包含微信特定字段
interface WeChatProfile {
  openid: string;
  unionid?: string;
  nickname?: string;
  headimgurl?: string;
}

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      openId?: string;
      unionId?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    openId?: string;
    unionId?: string;
    role?: string;
  }
}

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    WechatProvider({
      clientId: process.env.WECHAT_CLIENT_ID!,
      clientSecret: process.env.WECHAT_CLIENT_SECRET!,
      redirectUri: process.env.NEXTAUTH_URL + "/api/auth/callback/wechat",
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt" as const,
  },
  debug: true,
  callbacks: {
    async redirect({ url, baseUrl }) {
      // 允许相对URL和同源的绝对URL
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
    async jwt({ token, user, account, profile }) {
      console.log('JWT Callback:', { token, user, account, profile });
      
      if (account?.provider === 'wechat' && profile) {
        const wechatProfile = profile as WeChatProfile;
        // 保存微信的 OpenID 和 UnionID
        token.openId = wechatProfile.openid;
        token.unionId = wechatProfile.unionid;
        
        // 如果是新用户，设置默认角色
        if (!token.role) {
          const dbUser = await prisma.user.findUnique({
            where: { openId: wechatProfile.openid },
            select: { role: true }
          });
          token.role = dbUser?.role || 'USER';
        }
      }
      
      if (user) {
        token.id = user.id;
      }
      
      return token;
    },
    async session({ session, token }) {
      console.log('Session Callback:', { session, token });
      if (session.user) {
        session.user.id = token.id;
        session.user.openId = token.openId;
        session.user.unionId = token.unionId;
        session.user.role = token.role;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      console.log('SignIn Callback:', { user, account, profile });
      
      if (account?.provider === 'wechat' && profile) {
        try {
          const wechatProfile = profile as WeChatProfile;
          // 使用 OpenID 查找用户
          const existingUser = await prisma.user.findUnique({
            where: { openId: wechatProfile.openid },
          });

          if (!existingUser) {
            // 创建新用户，使用 OpenID 作为唯一标识
            await prisma.user.create({
              data: {
                openId: wechatProfile.openid,
                unionId: wechatProfile.unionid,
                name: wechatProfile.nickname || `User_${Math.random().toString(36).substring(7)}`,
                image: wechatProfile.headimgurl,
                role: 'USER',
              },
            });
          }
          return true;
        } catch (error) {
          console.error('Error in signIn callback:', error);
          return false;
        }
      }
      return true;
    },
  },
};

export async function getAuthSession() {
  return await getServerSession(authOptions);
}

// 基础认证检查
export async function requireAuth(
  req: NextRequest,
  handler: (req: NextRequest, userId: string) => Promise<NextResponse>
) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  return handler(req, session.user.id);
}

// 标记员权限检查
export async function requireMarker(
  req: NextRequest,
  handler: (req: NextRequest, userId: string) => Promise<NextResponse>
) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  if (session.user.role !== 'MARKER') {
    return NextResponse.json(
      { error: "Permission denied. Marker role required." },
      { status: 403 }
    );
  }

  return handler(req, session.user.id);
}

// 公共 API 处理
export async function publicApi(
  req: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  try {
    return await handler(req);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}