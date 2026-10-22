import { activityWhere,withAdminAccess } from "@/lib/admin/access";
import { NextRequest,NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  return withAdminAccess(req, async (access, db) => {
    const submissionRows = await db.corpus_collection_submissions.groupBy({
      by: ["review_status"],
      where: { activity: activityWhere(access) },
      _count: { _all: true },
    });
    const activityRows = await db.corpus_collection_activities.groupBy({
      by: ["status"],
      where: activityWhere(access),
      _count: { _all: true },
    });
    const [totalLikes, totalComments] = await Promise.all([
      db.corpus_collection_likes.count({ where: { submission: { activity: activityWhere(access) } } }),
      db.corpus_collection_comments.count({ where: { submission: { activity: activityWhere(access) } } }),
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
