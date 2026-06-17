import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseActivityMediaRequirements,
  parseActivityTextFields,
  parseActivityWindow,
  parseBigIntId,
  serializeActivity,
} from "@/lib/services/corpus-collection";

export async function GET(req: NextRequest, context: AppRouteContext) {
  return requireAdmin(req, async () => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) return NextResponse.json({ error: "Invalid activity id" }, { status: 400 });

    const activity = await prisma.corpus_collection_activities.findUnique({
      where: { id },
      include: { _count: { select: { submissions: true } } },
    });
    if (!activity) return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    return NextResponse.json(serializeActivity(activity));
  });
}

export async function PATCH(req: NextRequest, context: AppRouteContext) {
  return requireAdmin(req, async () => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) return NextResponse.json({ error: "Invalid activity id" }, { status: 400 });

    const body = await req.json();
    let textFields: ReturnType<typeof parseActivityTextFields>;
    let startsAt: Date | null | undefined;
    let endsAt: Date | null | undefined;
    let mediaRequirements: Prisma.InputJsonValue | undefined;
    try {
      textFields = parseActivityTextFields(body);
      if (body.startsAt !== undefined || body.endsAt !== undefined) {
        const parsedWindow = parseActivityWindow(body.startsAt, body.endsAt);
        startsAt = parsedWindow.startsAt;
        endsAt = parsedWindow.endsAt;
      }
      if (body.mediaRequirements !== undefined) {
        mediaRequirements = parseActivityMediaRequirements(body.mediaRequirements);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid activity payload";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const data = {
      title: textFields.title,
      slug: body.slug,
      description: textFields.description,
      rules: textFields.rules,
      category: body.category,
      tags: body.tags as Prisma.InputJsonValue | undefined,
      submission_types: body.submissionTypes as Prisma.InputJsonValue | undefined,
      reward_config: body.rewardConfig as Prisma.InputJsonValue | undefined,
      media_requirements: mediaRequirements,
      banner_url: body.bannerUrl,
      status: body.status,
      starts_at: startsAt,
      ends_at: endsAt,
    } as Prisma.corpus_collection_activitiesUncheckedUpdateInput;

    const activity = await prisma.corpus_collection_activities.update({
      where: { id },
      data,
    });
    return NextResponse.json(serializeActivity(activity));
  });
}
