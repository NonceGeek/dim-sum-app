import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Get public user information by userIds
 * GET /api/miniprogram/users/public
 *
 * Query Parameters:
 * - userIds: Comma-separated list of user IDs or array (e.g., "id1,id2,id3" or ["id1","id2","id3"])
 *
 * Response:
 * - users: Array of public user information (userId, username, avatar)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userIdsParam = searchParams.get("userIds");

    if (!userIdsParam) {
      return NextResponse.json(
        { error: "Missing required parameter: userIds" },
        { status: 400 }
      );
    }

    // Parse userIds - support both comma-separated string and JSON array
    let userIds: string[];
    try {
      // Try parsing as JSON array first
      userIds = JSON.parse(userIdsParam);
      if (!Array.isArray(userIds)) {
        throw new Error("Not an array");
      }
    } catch {
      // Fall back to comma-separated string
      userIds = userIdsParam.split(",").map((id) => id.trim()).filter(Boolean);
    }

    if (userIds.length === 0) {
      return NextResponse.json(
        { error: "No valid user IDs provided" },
        { status: 400 }
      );
    }

    // Limit the number of users to fetch at once
    if (userIds.length > 100) {
      return NextResponse.json(
        { error: "Maximum 100 user IDs allowed per request" },
        { status: 400 }
      );
    }

    // Fetch public user information
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: userIds,
        },
        status: "ACTIVE", // Only return active users
      },
      select: {
        id: true,
        name: true,
        image: true,
        wechatAvatar: true,
      },
    });

    // Transform to public format
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
}
