import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  return requireMiniprogramAuth(req, async (_req, user) => {
    const statusRows = await prisma.corpus_collection_submissions.groupBy({
      by: ["review_status"],
      where: { user_id: user.userId },
      _count: { _all: true },
    });
    const [activities, unreadNotifications] = await prisma.$transaction([
      prisma.corpus_collection_submissions.findMany({
        where: { user_id: user.userId, activity_id: { not: null } },
        select: { activity_id: true },
        distinct: ["activity_id"],
      }),
      prisma.corpus_collection_messages.count({
        where: { user_id: user.userId, is_read: false },
      }),
    ]);

    const statusCounts = new Map(
      statusRows.map((row) => [row.review_status, row._count._all]),
    );
    const total = statusRows.reduce((sum, row) => sum + row._count._all, 0);
    const approved = statusCounts.get("approved") ?? 0;
    const pending = ["pending_review", "ai_reviewing", "review_needed"].reduce(
      (sum, status) => sum + (statusCounts.get(status) ?? 0),
      0,
    );
    const rejected = statusCounts.get("rejected") ?? 0;

    return NextResponse.json({
      submissionCount: total,
      approvedCount: approved,
      pendingCount: pending,
      rejectedCount: rejected,
      activityCount: activities.length,
      points: approved * 10,
      unreadNotificationCount: unreadNotifications,
    });
  });
}
