import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { parseBigIntId } from "@/lib/services/corpus-collection";
import { AccessError } from "@/lib/services/submission-access";
import { PRIVATE_HEADERS, withLibraryOps } from "@/lib/library/ops-access";
import { corpusProvenance } from "@/lib/ingestion/service";

/** GET /api/admin/ingestion-provenance/:corpusId */
export async function GET(req: NextRequest, context: AppRouteContext) {
  return withLibraryOps(req, async (access) => {
    const corpusId = parseBigIntId(await getStringRouteParam(context, "corpusId"));
    if (!corpusId) throw new AccessError(400, "无效的语料 ID");
    return NextResponse.json(await corpusProvenance(access, corpusId), {
      headers: PRIVATE_HEADERS,
    });
  });
}
