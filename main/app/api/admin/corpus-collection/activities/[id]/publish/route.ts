import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBigIntId, serializeActivity } from "@/lib/services/corpus-collection";

export async function POST(req: NextRequest, context: AppRouteContext) {
  return requireAdmin(req, async () => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) return NextResponse.json({ error: "Invalid activity id" }, { status: 400 });
    const activity = await prisma.corpus_collection_activities.update({
      where: { id },
      data: { status: "published" },
    });
    return NextResponse.json(serializeActivity(activity));
  });
}
