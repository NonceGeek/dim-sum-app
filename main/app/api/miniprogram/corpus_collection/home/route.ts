import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { databaseErrorResponse } from "@/lib/prisma-errors";
import { PUBLIC_LIST_CACHE_HEADERS } from "@/lib/public-cache";
import {
  PUBLIC_SUBMISSION_COUNT,
  listPublicSubmissions,
  serializeHomeSubmission,
  serializePublicActivity,
} from "@/lib/services/corpus-collection";

export async function GET(_req: NextRequest) {
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
        include: {
          _count: { select: { submissions: PUBLIC_SUBMISSION_COUNT } },
        },
      }),
      listPublicSubmissions({ page: 1, pageSize: 10, includeRaw: true }),
      listPublicSubmissions({
        page: 1,
        pageSize: 10,
        featured: true,
        showOnHome: true,
      }),
    ]);

    return NextResponse.json(
      {
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
        activities: activities.map(serializePublicActivity),
        latestSubmissions: latest.rawItems.map(serializeHomeSubmission),
        featuredSubmissions: featured.items,
      },
      { headers: PUBLIC_LIST_CACHE_HEADERS },
    );
  } catch (error) {
    console.error("[CorpusCollection] Failed to load home", error);
    return databaseErrorResponse(error, "Failed to load home");
  }
}
