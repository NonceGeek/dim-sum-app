import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { prisma } from "@/lib/prisma";
import {
  listPublicSubmissions,
  serializeActivity,
} from "@/lib/services/corpus-collection";

export async function GET(req: NextRequest) {
  return requireMiniprogramAuth(req, async () => {
    try {
      const now = new Date();
      const [activities, latest, featured] = await Promise.all([
        prisma.corpus_collection_activities.findMany({
          where: {
            status: "published",
            OR: [{ starts_at: null }, { starts_at: { lte: now } }],
            AND: [{ OR: [{ ends_at: null }, { ends_at: { gte: now } }] }],
          },
          orderBy: [{ starts_at: "asc" }, { created_at: "desc" }],
          take: 5,
          include: { _count: { select: { submissions: true } } },
        }),
        listPublicSubmissions({ page: 1, pageSize: 10 }),
        listPublicSubmissions({
          page: 1,
          pageSize: 10,
          featured: true,
          showOnHome: true,
        }),
      ]);

      return NextResponse.json({
        banners: activities.map((activity) => ({
          id: activity.id.toString(),
          title: activity.title,
          imageUrl: activity.banner_url,
          linkType: "activity",
          linkId: activity.id.toString(),
        })),
        quickEntries: [
          { key: "submit", title: "我要投稿" },
          { key: "activities", title: "活动日历" },
          { key: "featured", title: "精选内容" },
        ],
        activities: activities.map(serializeActivity),
        latestSubmissions: latest.items,
        featuredSubmissions: featured.items,
      });
    } catch (error) {
      console.error("[CorpusCollection] Failed to load home", error);
      return NextResponse.json({ error: "Failed to load home" }, { status: 500 });
    }
  });
}
