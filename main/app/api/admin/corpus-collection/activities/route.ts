import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { ActivityCreationConflict, createActivityWithDataset, parseContentAttribute, type ContentAttribute } from "@/lib/dataset-management";
import { prisma } from "@/lib/prisma";
import {
  parseActivityMediaRequirements,
  parseActivityTags,
  parseActivityTextFields,
  parseActivityWindow,
  parsePositiveInt,
  serializeActivity,
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
  const status = searchParams.get("status");
  const q = searchParams.get("q");
  const qMode = searchParams.get("qMode");

  return requireAdmin(req, async () => {
    const activityIds =
      q && qMode === "activityUuid" ? await findActivityIdsByUuidFragment(q) : undefined;
    const where: Prisma.corpus_collection_activitiesWhereInput = {
      id: activityIds ? { in: activityIds } : undefined,
      status: status || undefined,
      title: q && qMode !== "activityUuid" ? { contains: q, mode: "insensitive" } : undefined,
    };
    const [items, total] = await prisma.$transaction([
      prisma.corpus_collection_activities.findMany({
        where,
        include: { dataset: true, _count: { select: { submissions: true } } },
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
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid activity payload" }, { status: 400 });
    let contentAttribute: ContentAttribute;
    const creationKey = body.creationKey;
    if (typeof creationKey !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(creationKey)) return NextResponse.json({ error: "A UUID creationKey is required" }, { status: 400 });

    let textFields: ReturnType<typeof parseActivityTextFields>;
    let startsAt: Date | null;
    let endsAt: Date | null;
    let mediaRequirements: Prisma.InputJsonValue;
    let tags: Prisma.InputJsonValue;
    try {
      contentAttribute = parseContentAttribute(body.contentAttribute);
      textFields = parseActivityTextFields(body, { requireTitle: true });
      tags = parseActivityTags(body.tags, { required: true }) ?? [];
      const parsedWindow = parseActivityWindow(body.startsAt, body.endsAt);
      startsAt = parsedWindow.startsAt;
      endsAt = parsedWindow.endsAt;
      mediaRequirements = parseActivityMediaRequirements(body.mediaRequirements);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid activity payload";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const data = {
      title: textFields.title ?? "",
      slug: body.slug || undefined,
      description: textFields.description,
      rules: textFields.rules,
      category: body.category,
      tags,
      submission_types: (body.submissionTypes ?? []) as Prisma.InputJsonValue,
      reward_config: (body.rewardConfig ?? {}) as Prisma.InputJsonValue,
      media_requirements: mediaRequirements,
      banner_url: body.bannerUrl,
      status: body.status || "draft",
      starts_at: startsAt,
      ends_at: endsAt,
      created_by: userId,
    } as Prisma.corpus_collection_activitiesUncheckedCreateInput;

    try {
      const { activity, replayed } = await createActivityWithDataset(prisma, data, contentAttribute, creationKey);
      return NextResponse.json(serializeActivity(activity), { status: replayed ? 200 : 201 });
    } catch (error) {
      if (error instanceof ActivityCreationConflict || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
        return NextResponse.json({ error: "Activity creation conflict; use the same details when retrying" }, { status: 409 });
      }
      console.error("Activity creation failed", error instanceof Error ? error.name : "UnknownError");
      return NextResponse.json({ error: "Failed to create activity" }, { status: 500 });
    }
  });
}
