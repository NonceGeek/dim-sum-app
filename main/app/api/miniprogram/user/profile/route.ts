import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Get user profile
 * GET /api/miniprogram/user/profile
 *
 * Headers:
 * - Authorization: Bearer <accessToken>
 *
 * Response:
 * - User profile information
 */
export async function GET(req: NextRequest) {
  return requireMiniprogramAuth(req, async (req, tokenUser) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: tokenUser.userId },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          wechatAvatar: true,
          role: true,
          bio: true,
          isSystemAdmin: true,
          phoneNumber: true,
        },
      });

      if (!user) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        user: {
          ...user,
          avatar: user.wechatAvatar || user.image,
        },
      });
    } catch (error) {
      console.error("Get profile error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}
