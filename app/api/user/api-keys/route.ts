import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  return requireAuth(req, async (req, userId) => {
    try {
      const { searchParams } = new URL(req.url);
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "10");
      const skip = (page - 1) * limit;

      const [apiKeys, total] = await Promise.all([
        prisma.api_key.findMany({
          where: {
            user_id: userId,
          },
          orderBy: {
            created_at: "desc",
          },
          skip,
          take: limit,
        }),
        prisma.api_key.count({
          where: {
            user_id: userId,
          },
        }),
      ]);

      return NextResponse.json({
        data: apiKeys,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching API keys:", error);
      return new NextResponse(
        JSON.stringify({ error: "Internal Server Error" }),
        { status: 500 }
      );
    }
  });
} 