import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { parseBigIntId } from "@/lib/services/corpus-collection";
import { AccessError } from "@/lib/services/submission-access";
import { PRIVATE_HEADERS, withLibraryOps } from "@/lib/library/ops-access";
import { decideApproval } from "@/lib/ingestion/service";

/**
 * POST /api/admin/ingestion-tasks/:id/approvals/:approvalId/decision {decision, note?}
 * 只写决定；之后由浏览器调入库 Agent 的 /approvals/:approvalId/execute 执行并续跑。
 */
export async function POST(req: NextRequest, context: AppRouteContext) {
  return withLibraryOps(req, async (access) => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    const approvalId = await getStringRouteParam(context, "approvalId");
    if (!id || !approvalId) throw new AccessError(400, "无效的审批");
    return NextResponse.json(
      await decideApproval(access, id, approvalId, await req.json().catch(() => ({}))),
      { headers: PRIVATE_HEADERS },
    );
  });
}
