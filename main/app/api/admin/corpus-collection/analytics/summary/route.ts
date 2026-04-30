import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  return requireAdmin(req, async () => {
    const [
      totalSubmissions,
      pendingSubmissions,
      approvedSubmissions,
      rejectedSubmissions,
      totalActivities,
      publishedActivities,
      totalLikes,
      totalComments,
    ] = await Promise.all([
      prisma.corpus_collection_submissions.count(),
      prisma.corpus_collection_submissions.count({
        where: { review_status: { in: ["pending_review", "ai_reviewing", "review_needed"] } },
      }),
      prisma.corpus_collection_submissions.count({ where: { review_status: "approved" } }),
      prisma.corpus_collection_submissions.count({ where: { review_status: "rejected" } }),
      prisma.corpus_collection_activities.count(),
      prisma.corpus_collection_activities.count({ where: { status: "published" } }),
      prisma.corpus_collection_likes.count(),
      prisma.corpus_collection_comments.count(),
    ]);

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
