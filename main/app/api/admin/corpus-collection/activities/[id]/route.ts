import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBigIntId, serializeActivity } from "@/lib/services/corpus-collection";

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
    const data = {
      title: body.title,
      slug: body.slug,
      description: body.description,
      rules: body.rules,
      category: body.category,
      tags: body.tags as Prisma.InputJsonValue | undefined,
      submission_types: body.submissionTypes as Prisma.InputJsonValue | undefined,
      reward_config: body.rewardConfig as Prisma.InputJsonValue | undefined,
      media_requirements: body.mediaRequirements as Prisma.InputJsonValue | undefined,
      banner_url: body.bannerUrl,
      status: body.status,
      starts_at: body.startsAt ? new Date(body.startsAt) : undefined,
      ends_at: body.endsAt ? new Date(body.endsAt) : undefined,
    } as Prisma.corpus_collection_activitiesUncheckedUpdateInput;

    const activity = await prisma.corpus_collection_activities.update({
      where: { id },
      data,
    });
    return NextResponse.json(serializeActivity(activity));
  });
}
