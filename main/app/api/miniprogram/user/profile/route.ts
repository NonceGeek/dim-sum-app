import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { prisma } from "@/lib/prisma";
import { buildQuestionnaireStatus } from "@/lib/services/questionnaire-status";

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
          questionnaireProfile: {
            select: { completed_at: true },
          },
        },
      });

      if (!user) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }

      const { questionnaireProfile, ...profile } = user;

      return NextResponse.json({
        user: {
          ...profile,
          avatar: user.wechatAvatar || user.image,
          questionnaireStatus: buildQuestionnaireStatus({
            phoneNumber: user.phoneNumber,
            questionnaireProfile,
          }),
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
