import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  return requireMiniprogramAuth(req, async (_req, user) => {
    const [total, approved, pending, rejected, activities] = await Promise.all([
      prisma.corpus_collection_submissions.count({ where: { user_id: user.userId } }),
      prisma.corpus_collection_submissions.count({
        where: { user_id: user.userId, review_status: "approved" },
      }),
      prisma.corpus_collection_submissions.count({
        where: { user_id: user.userId, review_status: { in: ["pending_review", "ai_reviewing", "review_needed"] } },
      }),
      prisma.corpus_collection_submissions.count({
        where: { user_id: user.userId, review_status: "rejected" },
      }),
      prisma.corpus_collection_submissions.findMany({
        where: { user_id: user.userId, activity_id: { not: null } },
        select: { activity_id: true },
        distinct: ["activity_id"],
      }),
    ]);

    return NextResponse.json({
      submissionCount: total,
      approvedCount: approved,
      pendingCount: pending,
      rejectedCount: rejected,
      activityCount: activities.length,
      points: approved * 10,
      unreadNotificationCount: 0,
    });
  });
}
