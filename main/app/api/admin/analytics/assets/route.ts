import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { parseRange } from "@/lib/analytics/dashboard";
import {
  CORPUS_ASSETS_TAG,
  loadAssetDataset,
  loadAssetSnapshot,
} from "@/lib/analytics/corpus-assets";

const noStore = { "Cache-Control": "private, no-store" };

// A snapshot scans every corpus note (~10 s on production data).
export const maxDuration = 60;

/**
 * GET /api/admin/analytics/assets                     — overview + dataset list (hourly snapshot)
 * GET /api/admin/analytics/assets?name=&from=&to=     — one dataset with its ingestion trend
 */
export async function GET(req: NextRequest) {
  return requireAdmin(req, async () => {
    const params = req.nextUrl.searchParams;
    const name = params.get("name");
    try {
      if (!name) return NextResponse.json(await loadAssetSnapshot(), { headers: noStore });
      const range = parseRange(params.get("from"), params.get("to"));
      if (!range) return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
      const detail = await loadAssetDataset(name, range);
      if (!detail) return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
      return NextResponse.json(detail, { headers: noStore });
    } catch (error) {
      console.error("Corpus asset query failed", error);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }
  });
}

/** POST — drop the cached snapshot; the next GET recomputes it instead of waiting for the hourly refresh. */
export async function POST(req: NextRequest) {
  return requireAdmin(req, async () => {
    revalidateTag(CORPUS_ASSETS_TAG, { expire: 0 }); // expire now, not stale-while-revalidate
    return NextResponse.json({ ok: true }, { headers: noStore });
  });
}
