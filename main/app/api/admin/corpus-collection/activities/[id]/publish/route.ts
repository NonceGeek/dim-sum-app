import { assertScope,withAdminAccess } from "@/lib/admin/access";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { parseBigIntId,serializeActivity } from "@/lib/services/corpus-collection";
import { NextRequest,NextResponse } from "next/server";

export async function POST(req: NextRequest, context: AppRouteContext) {
  return withAdminAccess(req, async (access, db) => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) return NextResponse.json({ error: "Invalid activity id" }, { status: 400 });
    assertScope(access, "activity", id, req.method === "GET" ? "view" : "manage");
    const activity = await db.corpus_collection_activities.update({
      where: { id },
      include: { dataset: true },
      data: { status: "published" },
    });
    return NextResponse.json(serializeActivity(activity));
  });
}
