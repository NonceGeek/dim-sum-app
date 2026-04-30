import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { prisma } from "@/lib/prisma";
import { parseBigIntId, serializeActivity } from "@/lib/services/corpus-collection";

export async function GET(req: NextRequest, context: AppRouteContext) {
  return requireMiniprogramAuth(req, async () => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) {
      return NextResponse.json({ error: "Invalid activity id" }, { status: 400 });
    }

    const activity = await prisma.corpus_collection_activities.findFirst({
      where: { id, status: "published" },
      include: { _count: { select: { submissions: true } } },
    });

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    return NextResponse.json({ ...serializeActivity(activity), canShare: true });
  });
}
