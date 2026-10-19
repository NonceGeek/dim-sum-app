import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { parseBigIntId } from "@/lib/services/corpus-collection";
import { AccessError } from "@/lib/services/submission-access";
import { PRIVATE_HEADERS, withLibraryOps } from "@/lib/library/ops-access";
import { listTaskRecords } from "@/lib/ingestion/service";

/** GET /api/admin/ingestion-tasks/:id/records?cursor=&limit= */
export async function GET(req: NextRequest, context: AppRouteContext) {
  return withLibraryOps(req, async (access) => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) throw new AccessError(400, "无效的任务 ID");
    return NextResponse.json(
      await listTaskRecords(access, id, new URL(req.url).searchParams),
      { headers: PRIVATE_HEADERS },
    );
  });
}
