import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { prisma } from "@/lib/prisma";
import {
  parsePositiveInt,
  serializeActivity,
} from "@/lib/services/corpus-collection";

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams;
  const status = searchParams.get("status") || "published";
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), 10, 50);

  return requireMiniprogramAuth(req, async () => {
    try {
      const where = { status };
      const [items, total] = await Promise.all([
        prisma.corpus_collection_activities.findMany({
          where,
          include: { _count: { select: { submissions: true } } },
          orderBy: [{ starts_at: "desc" }, { created_at: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.corpus_collection_activities.count({ where }),
      ]);

      return NextResponse.json({
        items: items.map(serializeActivity),
        pagination: { page, pageSize, total },
      });
    } catch (error) {
      console.error("[CorpusCollection] Failed to load activities", error);
      return NextResponse.json(
        { error: "Failed to load activities" },
        { status: 500 }
      );
    }
  });
}
