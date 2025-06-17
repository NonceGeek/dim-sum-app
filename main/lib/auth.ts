import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { AuthOptions } from "next-auth";
// import { JWT } from "next-auth/jwt";
// import { User } from "next-auth";
import WechatProvider from "@/providers/wechat";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient, Role } from "@prisma/client";

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
      role?: Role;
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    openId?: string;
    unionId?: string;
    role?: Role;
    image?: string | null;
  }
}

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    WechatProvider({
      clientId: process.env.NEXT_PUBLIC_WECHAT_CLIENT_ID!,
      clientSecret: process.env.WECHAT_CLIENT_SECRET!,
      redirectUri: `${process.env.NEXTAUTH_URL}/api/auth/callback/wechat`,
    }),
  ],
  pages: {
    signIn: "",
  },
  session: {
    strategy: "jwt" as const,
  },
  debug: false,
  callbacks: {
    async redirect({ url, baseUrl }) {
      // console.log('Redirect callback start:', { url, baseUrl });
      
      // 添加 login 参数到 URL
      const targetUrl = url.startsWith("/") 
        ? `${baseUrl}${url}` 
        : new URL(url).origin === baseUrl 
          ? url 
          : baseUrl;
      
      // 添加 login 参数
      const urlObj = new URL(targetUrl);
      urlObj.searchParams.set('login', 'success');
      
      // console.log('Redirect callback end:', { result: urlObj.toString() });
      return urlObj.toString();
    },
    async jwt({ token, user, account, profile }) {
      // console.log('JWT Callback start:', { token, user, account, profile });
      // const startTime = Date.now();
      
      if (account?.provider === 'wechat' && profile) {
        const wechatProfile = profile as WeChatProfile;
        token.openId = wechatProfile.openid;
        token.unionId = wechatProfile.unionid;
        token.image = wechatProfile.headimgurl;
        
        // 只在需要时查询用户角色
        if (!token.role && !token.id) {
          // console.log('Fetching user role...');
          const dbAccount = await prisma.account.findFirst({
            where: { 
              provider: 'wechat',
              providerAccountId: wechatProfile.openid 
            },
            select: {
              user: {
                select: {
                  id: true,
                  role: true,
                  image: true
                }
              }
            }
          });
          
          if (dbAccount?.user) {
            token.id = dbAccount.user.id;
            token.role = dbAccount.user.role;
            token.image = dbAccount.user.image || wechatProfile.headimgurl;
          } else {
            // 使用从 URL 中获取的角色，如果没有则默认为 LEARNER
            token.role = (account.role as Role) || Role.LEARNER;
          }
          // console.log('User role fetched:', token.role);
        }
      }
      
      if (user) {
        token.id = user.id;
      }
      
      // console.log('JWT Callback end:', { 
      //   executionTime: Date.now() - startTime,
      //   token 
      // });
      return token;
    },
    async session({ session, token }) {
      // console.log('Session Callback start:', { session, token });
      // const startTime = Date.now();
      
      if (session.user) {
        session.user.id = token.id;
        session.user.openId = token.openId;
        session.user.unionId = token.unionId;
        session.user.role = token.role;
        session.user.image = token.image;
      }
      
      // console.log('Session Callback end:', { 
      //   executionTime: Date.now() - startTime,
      //   session 
      // });
      return session;
    },
    async signIn({ account, profile }) {
      // console.log('SignIn Callback start:', { user, account, profile });
      const startTime = Date.now();
      
      if (account?.provider === 'wechat' && profile) {
        try {
          const wechatProfile = profile as WeChatProfile;
          // console.log('Checking existing account...');
          
          // 使用事务来确保数据一致性
          await prisma.$transaction(async (tx) => {
            const existingAccount = await tx.account.findFirst({
              where: { 
                provider: 'wechat',
                providerAccountId: wechatProfile.openid 
              },
              select: {
                id: true,
                user: {
                  select: {
                    id: true,
                    role: true,
                    wechatAvatar: true
                  }
                }
              }
            });

            if (!existingAccount) {
              // console.log('Creating new user and account...');
              const newUser = await tx.user.create({
                data: {
                  name: wechatProfile.nickname || `User_${Math.random().toString(36).substring(7)}`,
                  wechatAvatar: wechatProfile.headimgurl,  // 保存微信头像
                  accounts: {
                    create: {
                      type: 'oauth',
                      provider: 'wechat',
                      providerAccountId: wechatProfile.openid,
                      openId: wechatProfile.openid,
                      unionId: wechatProfile.unionid,
                      access_token: account.access_token,
                      refresh_token: account.refresh_token,
                      expires_at: account.expires_at,
                      scope: account.scope,
                    }
                  }
                },
                select: {
                  id: true,
                  role: true,
                  wechatAvatar: true
                }
              });
              // console.log('New user and account created');
              return newUser;
            }
            
            // 如果用户存在但微信头像为空，更新微信头像
            if (!existingAccount.user.wechatAvatar) {
              await tx.user.update({
                where: { id: existingAccount.user.id },
                data: { wechatAvatar: wechatProfile.headimgurl }
              });
            }
            
            // console.log('Existing account found');
            return existingAccount.user;
          });
          
          // console.log('SignIn Callback end:', { 
          //   executionTime: Date.now() - startTime,
          //   success: true,
          //   userId: result.id
          // });
          return true;
        } catch (error) {
          console.error('Error in signIn callback:', error);
          console.log('SignIn Callback end with error:', { 
            executionTime: Date.now() - startTime,
            error 
          });
          return false;
        }
      }
      
      // console.log('SignIn Callback end:', { 
      //   executionTime: Date.now() - startTime,
      //   success: true 
      // });
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

  if (session.user.role !== Role.TAGGER_PARTNER && session.user.role !== Role.TAGGER_OUTSOURCING) {
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