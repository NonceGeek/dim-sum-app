import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBigIntId, serializeActivity } from "@/lib/services/corpus-collection";

export async function GET(req: NextRequest, context: AppRouteContext) {
  return requireAdmin(req, async () => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) return NextResponse.json({ error: "Invalid activity id" }, { status: 400 });

    const activity = await prisma.corpus_collection_activities.findUnique({
      where: { id },
      include: { _count: { select: { submissions: true } } },
    });
    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const [statusRows, interaction] = await Promise.all([
      prisma.corpus_collection_submissions.groupBy({
        by: ["review_status"],
        where: { activity_id: id },
        _count: { _all: true },
      }),
      prisma.corpus_collection_submissions.aggregate({
        where: { activity_id: id },
        _sum: {
          like_count: true,
          comment_count: true,
          share_count: true,
          view_count: true,
        },
      }),
    ]);

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
