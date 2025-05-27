import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { AuthOptions } from "next-auth";
import { JWT } from "next-auth/jwt";
import { User } from "next-auth";
import WechatProvider from "@/providers/wechat";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
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
  callbacks: {
    async jwt({ token, user }: { token: JWT; user: User | undefined }) {
      if (user) {
        token.id = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true }
        });
        token.role = dbUser?.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
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