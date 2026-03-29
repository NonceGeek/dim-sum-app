import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  return requireAuth(req, async () => {
    try {
      const { searchParams } = new URL(req.url);
      const userIdsParam = searchParams.get("userIds");

      if (!userIdsParam) {
        return NextResponse.json(
          { error: "Missing required parameter: userIds" },
          { status: 400 }
        );
      }

      let userIds: string[];
      try {
        userIds = JSON.parse(userIdsParam);
        if (!Array.isArray(userIds)) {
          throw new Error("Not an array");
        }
      } catch {
        userIds = userIdsParam
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean);
      }

      if (userIds.length === 0) {
        return NextResponse.json(
          { error: "No valid user IDs provided" },
          { status: 400 }
        );
      }

      if (userIds.length > 100) {
        return NextResponse.json(
          { error: "Maximum 100 user IDs allowed per request" },
          { status: 400 }
        );
      }

      const users = await prisma.user.findMany({
        where: {
          id: { in: userIds },
          status: "ACTIVE",
        },
        select: {
          id: true,
          name: true,
          image: true,
          wechatAvatar: true,
        },
      });

      const publicUsers = users.map((user) => ({
        userId: user.id,
        username: user.name || "匿名用户",
        avatar: user.wechatAvatar || user.image || null,
      }));

      return NextResponse.json({
        users: publicUsers,
        total: publicUsers.length,
      });
    } catch (error) {
      console.error("Get public users error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}
