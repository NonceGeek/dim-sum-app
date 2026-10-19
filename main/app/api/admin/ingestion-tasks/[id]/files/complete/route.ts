import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { parseBigIntId } from "@/lib/services/corpus-collection";
import { AccessError } from "@/lib/services/submission-access";
import { PRIVATE_HEADERS, withLibraryOps } from "@/lib/library/ops-access";
import { completeFileUpload } from "@/lib/ingestion/service";

/** POST /api/admin/ingestion-tasks/:id/files/complete {path} */
export async function POST(req: NextRequest, context: AppRouteContext) {
  return withLibraryOps(req, async (access) => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) throw new AccessError(400, "无效的任务 ID");
    const file = await completeFileUpload(access, id, await req.json().catch(() => ({})));
    return NextResponse.json(
      { id: String(file.id), path: file.path, size: Number(file.size), status: file.status },
      { headers: PRIVATE_HEADERS },
    );
  });
}
