import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET /api/admin/stats
 * 获取管理员仪表板统计数据
 * 需要管理员权限
 */
export async function GET(req: NextRequest) {
  return requireAdmin(req, async () => {
    try {
      // 并行查询所有统计数据以提高性能
      const [totalUsers, totalCorpusEntries, recentActiveUsers] = await Promise.all([
        // 总用户数
        prisma.user.count(),

        // 总语料数据条目数
        prisma.cantonese_corpus_all.count(),

        // 活跃用户数（过去30天有互动的用户）
        prisma.user_corpus_interactions.findMany({
          where: {
            updated_at: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30天前
            },
          },
          select: {
            user_id: true,
          },
          distinct: ['user_id'],
        }),
      ]);

      const activeUsers = recentActiveUsers.length;

      return NextResponse.json({
        totalUsers,
        activeUsers,
        totalCorpusEntries: Number(totalCorpusEntries),
      });
    } catch (error) {
      console.error("Failed to fetch admin stats:", error);
      return NextResponse.json(
        { error: "Failed to fetch statistics" },
        { status: 500 }
      );
    }
  });
}
