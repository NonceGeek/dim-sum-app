import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { prisma } from "@/lib/prisma";
import {
  PUBLIC_SUBMISSION_COUNT,
  parseBigIntId,
  serializePublicActivity,
} from "@/lib/services/corpus-collection";

export async function GET(_req: NextRequest, context: AppRouteContext) {
  const id = parseBigIntId(await getStringRouteParam(context, "id"));
  if (!id) {
    return NextResponse.json({ error: "Invalid activity id" }, { status: 400 });
  }

  const activity = await prisma.corpus_collection_activities.findFirst({
    where: { id, status: "published" },
    include: {
      _count: { select: { submissions: PUBLIC_SUBMISSION_COUNT } },
    },
  });

  if (!activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  return NextResponse.json({ ...serializePublicActivity(activity), canShare: true });
}
