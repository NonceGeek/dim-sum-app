import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { parseBigIntId } from "@/lib/services/corpus-collection";
import { AccessError } from "@/lib/services/submission-access";
import { PRIVATE_HEADERS, withLibraryOps } from "@/lib/library/ops-access";
import { reportDownloadUrl } from "@/lib/ingestion/service";

/** GET /api/admin/ingestion-tasks/:id/report/download?version=&format=md|xlsx|json → 302 到临时下载地址 */
export async function GET(req: NextRequest, context: AppRouteContext) {
  return withLibraryOps(req, async (access) => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) throw new AccessError(400, "无效的任务 ID");
    const params = new URL(req.url).searchParams;
    const version = Number(params.get("version"));
    if (!Number.isInteger(version) || version < 1) throw new AccessError(400, "无效的报告版本");
    const url = await reportDownloadUrl(access, id, version, params.get("format") ?? "md");
    return NextResponse.redirect(url, { status: 302, headers: PRIVATE_HEADERS });
  });
}
