import { assertScope,withAdminAccess } from "@/lib/admin/access";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { parseBigIntId,serializeActivity } from "@/lib/services/corpus-collection";
import { NextRequest,NextResponse } from "next/server";

export async function GET(req: NextRequest, context: AppRouteContext) {
  return withAdminAccess(req, async (access, db) => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) return NextResponse.json({ error: "Invalid activity id" }, { status: 400 });

    assertScope(access, "activity", id);
    const activity = await db.corpus_collection_activities.findUnique({
      where: { id },
      include: { _count: { select: { submissions: true } } },
    });
    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const statusRows = await db.corpus_collection_submissions.groupBy({
      by: ["review_status"],
      where: { activity_id: id },
      _count: { _all: true },
    });
    const interaction = await db.corpus_collection_submissions.aggregate({
      where: { activity_id: id },
      _sum: {
        like_count: true,
        comment_count: true,
        share_count: true,
        view_count: true,
      },
    });

    return NextResponse.json({
      activity: serializeActivity(activity),
      statusBreakdown: statusRows.map((row) => ({
        status: row.review_status,
        total: row._count._all,
      })),
      interactions: {
        likes: interaction._sum.like_count ?? 0,
        comments: interaction._sum.comment_count ?? 0,
        shares: interaction._sum.share_count ?? 0,
        views: interaction._sum.view_count ?? 0,
      },
    });
  });
}
