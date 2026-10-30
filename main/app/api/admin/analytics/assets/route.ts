import { assertDataset,withAdminAccess } from "@/lib/admin/access";
import { scopeIds } from "@/lib/admin/policy";
import { AccessError } from "@/lib/admin/security";
import {
	CORPUS_ASSETS_TAG,
	computeSnapshot,
	loadAssetDataset,
	loadAssetSnapshot,
} from "@/lib/analytics/corpus-assets";
import { parseRange } from "@/lib/analytics/dashboard";
import { revalidateTag } from "next/cache";
import { NextRequest,NextResponse } from "next/server";

const noStore = { "Cache-Control": "private, no-store" };

// A snapshot scans every corpus note (~10 s on production data).
export const maxDuration = 60;

/**
 * GET /api/admin/analytics/assets                     — overview + dataset list (hourly snapshot)
 * GET /api/admin/analytics/assets?name=&from=&to=     — one dataset with its ingestion trend
 */
export async function GET(req: NextRequest) {
  return withAdminAccess(req, async (access, db) => {
    const params = req.nextUrl.searchParams;
    const name = params.get("name");
    try {
      if (!name) {
        if (access.isPlatformAdmin) return NextResponse.json(await loadAssetSnapshot(), { headers: noStore });
        const ids = scopeIds(access, "dataset") ?? [];
        const datasets = await db.cantonese_categories.findMany({ where: { id: { in: ids } }, select: { name: true } });
        return NextResponse.json(await computeSnapshot(db, datasets.map(d => d.name)), { headers: noStore });
      }
      await assertDataset(access, name, "view", db);
      const range = parseRange(params.get("from"), params.get("to"));
      if (!range) return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
      const detail = await loadAssetDataset(name, range);
      if (!detail) return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
      return NextResponse.json(detail, { headers: noStore });
    } catch (error) {
      if (error instanceof AccessError) throw error;
      console.error("Corpus asset query failed", error);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }
  });
}

/** POST — drop the cached snapshot; the next GET recomputes it instead of waiting for the hourly refresh. */
export async function POST(req: NextRequest) {
  return withAdminAccess(req, async (access, db) => {
    if (access.isPlatformAdmin) revalidateTag(CORPUS_ASSETS_TAG, { expire: 0 }); // expire now, not stale-while-revalidate
    return NextResponse.json({ ok: true }, { headers: noStore });
  });
}
