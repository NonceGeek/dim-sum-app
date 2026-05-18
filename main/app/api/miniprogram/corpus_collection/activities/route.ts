import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { prisma } from "@/lib/prisma";
import {
  PUBLIC_SUBMISSION_WHERE,
  parsePositiveInt,
  serializeActivity,
  submissionInclude,
} from "@/lib/services/corpus-collection";

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams;
  const status = searchParams.get("status") || "published";
  const keyword = searchParams.get("keyword") || searchParams.get("q");
  const includeExpired = searchParams.get("includeExpired") === "true";
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), 10, 50);

  return requireMiniprogramAuth(req, async () => {
    try {
      const now = new Date();
      const and: Prisma.corpus_collection_activitiesWhereInput[] = [{ status }];

      if (!includeExpired) {
        and.push({ OR: [{ ends_at: null }, { ends_at: { gte: now } }] });
      }

      if (keyword) {
        and.push({
          OR: [
            { title: { contains: keyword, mode: "insensitive" } },
            { description: { contains: keyword, mode: "insensitive" } },
          ],
        });
      }

      const where: Prisma.corpus_collection_activitiesWhereInput = { AND: and };
      const [items, total] = await Promise.all([
        prisma.corpus_collection_activities.findMany({
          where,
          include: {
            _count: { select: { submissions: true } },
            submissions: {
              where: PUBLIC_SUBMISSION_WHERE,
              include: submissionInclude,
              orderBy: [
                { like_count: "desc" },
                { comment_count: "desc" },
                { share_count: "desc" },
                { view_count: "desc" },
                { created_at: "desc" },
              ],
              take: 3,
            },
          },
          orderBy: [
            { ends_at: "desc" },
            { submissions: { _count: "desc" } },
            { starts_at: "desc" },
            { created_at: "desc" },
          ],
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
