import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { allowedActivityIds } from "@/lib/collection-permissions";
import { withSubmissionAccess } from "@/lib/services/submission-access";
export async function GET(req: NextRequest) {
  return withSubmissionAccess(req, async (access) => {
    const activities = await prisma.corpus_collection_activities.findMany({
      where: access.isAdmin ? {} : { id: { in: allowedActivityIds(access) } },
      select: { id: true, title: true, display_uuid: true },
      orderBy: { created_at: "desc" },
    });
    const canViewInsights =
      access.isAdmin ||
      (await prisma.corpus_collection_activity_permissions.count({
        where: { user_id: access.userId, can_view_insights: true },
      })) > 0;
    return NextResponse.json(
      {
        ...access,
        canViewInsights,
        items: activities.map((a) => ({
          id: String(a.id),
          title: a.title,
          displayUuid: a.display_uuid,
        })),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  });
}
