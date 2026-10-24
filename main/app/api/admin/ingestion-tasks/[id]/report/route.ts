import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { parseBigIntId } from "@/lib/services/corpus-collection";
import { AccessError } from "@/lib/services/submission-access";
import { PRIVATE_HEADERS, withLibraryOps } from "@/lib/library/ops-access";
import { getTaskReports, regenerateReport } from "@/lib/ingestion/service";

/** GET /api/admin/ingestion-tasks/:id/report：报告列表与最新报告正文 */
export async function GET(req: NextRequest, context: AppRouteContext) {
  return withLibraryOps(req, async (access) => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) throw new AccessError(400, "无效的任务 ID");
    return NextResponse.json(await getTaskReports(access, id), { headers: PRIVATE_HEADERS });
  });
}

/** POST /api/admin/ingestion-tasks/:id/report {kind: "final"|"draft", narrative?}：重新生成 */
export async function POST(req: NextRequest, context: AppRouteContext) {
  return withLibraryOps(req, async (access) => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) throw new AccessError(400, "无效的任务 ID");
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(await regenerateReport(access, id, body), {
      status: 202,
      headers: PRIVATE_HEADERS,
    });
  });
}
