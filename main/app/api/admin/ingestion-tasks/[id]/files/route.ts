import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { parseBigIntId } from "@/lib/services/corpus-collection";
import { AccessError } from "@/lib/services/submission-access";
import { PRIVATE_HEADERS, withLibraryOps } from "@/lib/library/ops-access";
import { signFileUpload } from "@/lib/ingestion/service";

/** POST /api/admin/ingestion-tasks/:id/files {path, size} → 浏览器直传 OSS 的签名 URL */
export async function POST(req: NextRequest, context: AppRouteContext) {
  return withLibraryOps(req, async (access) => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) throw new AccessError(400, "无效的任务 ID");
    return NextResponse.json(
      await signFileUpload(access, id, await req.json().catch(() => ({}))),
      { status: 201, headers: PRIVATE_HEADERS },
    );
  });
}
