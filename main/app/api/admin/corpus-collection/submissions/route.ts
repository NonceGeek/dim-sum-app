import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseBigIntId,
  parsePositiveInt,
  serializeSubmission,
  submissionInclude,
} from "@/lib/services/corpus-collection";

const UUID_PREFIX_PATTERN = /^[0-9a-f-]{1,36}$/i;

async function findActivityIdsByUuidFragment(value: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (!UUID_PREFIX_PATTERN.test(trimmed)) return [];

  const rows = await prisma.$queryRaw<Array<{ id: bigint }>>`
    SELECT id
    FROM corpus_collection_activities
    WHERE display_uuid::text LIKE ${`%${trimmed.toLowerCase()}%`}
  `;
  return rows.map((row) => row.id);
}

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams;
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), 20, 100);
  const activityId = parseBigIntId(searchParams.get("activityId"));
  const withoutActivity = searchParams.get("withoutActivity") === "true";
  const reviewStatus = searchParams.get("reviewStatus");
  const submissionType = searchParams.get("submissionType");
  const q = searchParams.get("q");
  const qMode = searchParams.get("qMode");

  return requireAdmin(req, async () => {
    const activityUuidIds =
      q && qMode === "activityUuid" ? await findActivityIdsByUuidFragment(q) : undefined;
    const activityIdFilter = activityId
      ? activityUuidIds
        ? { in: activityUuidIds.filter((id) => id === activityId) }
        : activityId
      : withoutActivity
        ? activityUuidIds
          ? { in: [] }
          : null
        : activityUuidIds
          ? { in: activityUuidIds }
          : undefined;

    const where: Prisma.corpus_collection_submissionsWhereInput = {
      activity_id: activityIdFilter,
      review_status: reviewStatus || undefined,
      submission_type: submissionType || undefined,
      OR: q && qMode !== "activityUuid"
        ? [
            { title: { contains: q, mode: "insensitive" } },
            { intro: { contains: q, mode: "insensitive" } },
          ]
        : undefined,
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
      items: items.map((item) => serializeSubmission(item)),
      pagination: { page, pageSize, total },
    });
  });
}
