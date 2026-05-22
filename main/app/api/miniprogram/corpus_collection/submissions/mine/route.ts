import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { prisma } from "@/lib/prisma";
import {
  parseBigIntId,
  parsePositiveInt,
  serializeSubmission,
  submissionInclude,
} from "@/lib/services/corpus-collection";

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams;
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), 10, 50);
  const reviewStatus = searchParams.get("reviewStatus");
  const awardStatus = searchParams.get("awardStatus");
  const activityId = parseBigIntId(searchParams.get("activityId"));
  const withoutActivity = searchParams.get("withoutActivity") === "true";

  return requireMiniprogramAuth(req, async (_req, user) => {
    const where: Prisma.corpus_collection_submissionsWhereInput = {
      user_id: user.userId,
      review_status: reviewStatus || undefined,
      award_status: awardStatus || undefined,
      activity_id: activityId ?? (withoutActivity ? null : undefined),
    };
    const [items, total] = await Promise.all([
      prisma.corpus_collection_submissions.findMany({
        where,
        include: submissionInclude,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.corpus_collection_submissions.count({ where }),
    ]);

    return NextResponse.json({
      items: items.map((item) => serializeSubmission(item, undefined, user.userId)),
      pagination: { page, pageSize, total },
    });
  });
}
