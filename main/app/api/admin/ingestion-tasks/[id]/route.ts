import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { parseBigIntId } from "@/lib/services/corpus-collection";
import { AccessError } from "@/lib/services/submission-access";
import { PRIVATE_HEADERS, withLibraryOps } from "@/lib/library/ops-access";
import { getTaskDetail, updateTask } from "@/lib/ingestion/service";

/** GET /api/admin/ingestion-tasks/:id */
export async function GET(req: NextRequest, context: AppRouteContext) {
  return withLibraryOps(req, async (access) => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) throw new AccessError(400, "无效的任务 ID");
    return NextResponse.json(await getTaskDetail(access, id), { headers: PRIVATE_HEADERS });
  });
}

/** PATCH /api/admin/ingestion-tasks/:id：修改草稿，字段同新建 */
export async function PATCH(req: NextRequest, context: AppRouteContext) {
  return withLibraryOps(req, async (access) => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) throw new AccessError(400, "无效的任务 ID");
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(await updateTask(access, id, body), { headers: PRIVATE_HEADERS });
  });
}
