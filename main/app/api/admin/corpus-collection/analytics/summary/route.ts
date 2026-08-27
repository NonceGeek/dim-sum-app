import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  return requireAdmin(req, async () => {
    const submissionRows = await prisma.corpus_collection_submissions.groupBy({
      by: ["review_status"],
      _count: { _all: true },
    });
    const activityRows = await prisma.corpus_collection_activities.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const [totalLikes, totalComments] = await prisma.$transaction([
      prisma.corpus_collection_likes.count(),
      prisma.corpus_collection_comments.count(),
    ]);

    const submissionCounts = new Map(
      submissionRows.map((row) => [row.review_status, row._count._all]),
    );
    const activityCounts = new Map(
      activityRows.map((row) => [row.status, row._count._all]),
    );
    const totalSubmissions = submissionRows.reduce(
      (sum, row) => sum + row._count._all,
      0,
    );
    const pendingSubmissions = [
      "pending_review",
      "ai_reviewing",
      "review_needed",
    ].reduce(
      (sum, status) => sum + (submissionCounts.get(status) ?? 0),
      0,
    );
    const approvedSubmissions = submissionCounts.get("approved") ?? 0;
    const rejectedSubmissions = submissionCounts.get("rejected") ?? 0;
    const totalActivities = activityRows.reduce(
      (sum, row) => sum + row._count._all,
      0,
    );
    const publishedActivities = activityCounts.get("published") ?? 0;

    return NextResponse.json({
      totalSubmissions,
      pendingSubmissions,
      approvedSubmissions,
      rejectedSubmissions,
      totalActivities,
      publishedActivities,
      totalLikes,
      totalComments,
    });
  });
}
