import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  return requireMiniprogramAuth(req, async (_req, user) => {
    const submissions = await prisma.corpus_collection_submissions.groupBy({
      by: ["activity_id", "review_status", "award_status"],
      where: { user_id: user.userId, activity_id: { not: null } },
      _count: { _all: true },
    });
    const activityIds = [
      ...new Set(submissions.map((item) => item.activity_id).filter(Boolean)),
    ] as bigint[];
    const activities = await prisma.corpus_collection_activities.findMany({
      where: { id: { in: activityIds } },
      select: { id: true, title: true },
    });
    const titleMap = Object.fromEntries(activities.map((item) => [item.id.toString(), item.title]));

    return NextResponse.json({
      items: activityIds.map((id) => {
        const rows = submissions.filter((item) => item.activity_id === id);
        return {
          id: id.toString(),
          title: titleMap[id.toString()] ?? "",
          submissionCount: rows.reduce((sum, item) => sum + item._count._all, 0),
          approvedCount: rows
            .filter((item) => item.review_status === "approved")
            .reduce((sum, item) => sum + item._count._all, 0),
          awardStatus: rows.find((item) => item.award_status !== "none")?.award_status ?? "none",
        };
      }),
    });
  });
}
