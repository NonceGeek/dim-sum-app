import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parsePositiveInt,
  serializeActivity,
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
  const status = searchParams.get("status");
  const q = searchParams.get("q");
  const qMode = searchParams.get("qMode");

  return requireAdmin(req, async () => {
    const where: Prisma.corpus_collection_activitiesWhereInput = {
      status: status || undefined,
      display_uuid: q && qMode === "activityUuid" ? normalizeUuid(q) : undefined,
      title: q && qMode !== "activityUuid" ? { contains: q, mode: "insensitive" } : undefined,
    };
    const [items, total] = await Promise.all([
      prisma.corpus_collection_activities.findMany({
        where,
        include: { _count: { select: { submissions: true } } },
        orderBy: { created_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.corpus_collection_activities.count({ where }),
    ]);

    return NextResponse.json({
      items: items.map(serializeActivity),
      pagination: { page, pageSize, total },
    });
  });
}

export async function POST(req: NextRequest) {
  return requireAdmin(req, async (_req, userId) => {
    const body = await req.json();
    if (!body.title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const data = {
      title: body.title,
      slug: body.slug || undefined,
      description: body.description,
      rules: body.rules,
      category: body.category,
      tags: (body.tags ?? []) as Prisma.InputJsonValue,
      submission_types: (body.submissionTypes ?? []) as Prisma.InputJsonValue,
      reward_config: (body.rewardConfig ?? {}) as Prisma.InputJsonValue,
      media_requirements: (body.mediaRequirements ?? {}) as Prisma.InputJsonValue,
      banner_url: body.bannerUrl,
      status: body.status || "draft",
      starts_at: body.startsAt ? new Date(body.startsAt) : null,
      ends_at: body.endsAt ? new Date(body.endsAt) : null,
      created_by: userId,
    } as Prisma.corpus_collection_activitiesUncheckedCreateInput;

    const activity = await prisma.corpus_collection_activities.create({ data });

    return NextResponse.json(serializeActivity(activity), { status: 201 });
  });
}
