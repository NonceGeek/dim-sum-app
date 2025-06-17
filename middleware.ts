import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Role } from "@prisma/client";

export default withAuth(
  function middleware(req: NextRequest) {
    // 获取请求路径
    const path = req.nextUrl.pathname;

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // 检查 token 是否存在
        if (!token) return false;

        const path = req.nextUrl.pathname;

        // 标记员专用路由
        if (path.startsWith('/api/marker') || path.startsWith('/marker')) {
          return token.role === Role.TAGGER_PARTNER || token.role === Role.TAGGER_OUTSOURCING;
        }

        // 普通用户路由
        return true;
      },
    },
    pages: {
      signIn: '/auth/signin',
    },
  }
);

// 配置需要保护的路由
export const config = {
  matcher: [
    // 保护所有 API 路由，但排除公共接口和认证相关接口
    "/api/((?!public|auth).*)",
    // 保护需要认证的页面
    "/dashboard/:path*",
    "/profile/:path*",
    "/account/:path*",
    // 标记员专用路由
    "/marker/:path*",
    "/api/marker/:path*",
  ],
}; 