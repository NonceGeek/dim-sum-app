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

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeUuid(value: string | null) {
  const trimmed = value?.trim();
  return trimmed && UUID_PATTERN.test(trimmed) ? trimmed : NIL_UUID;
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
    const where: Prisma.corpus_collection_submissionsWhereInput = {
      activity_id: activityId ?? (withoutActivity ? null : undefined),
      activity: q && qMode === "activityUuid" ? { display_uuid: normalizeUuid(q) } : undefined,
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
