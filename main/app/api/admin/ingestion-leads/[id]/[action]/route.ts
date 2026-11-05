import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { parseBigIntId } from "@/lib/services/corpus-collection";
import { AccessError } from "@/lib/services/submission-access";
import { LEAD_ACTIONS, LeadAction } from "@/lib/library/application-workflow";
import { PRIVATE_HEADERS, withLibraryOps } from "@/lib/library/ops-access";
import { performLeadAction } from "@/lib/library/contribution-service";

/** POST /api/admin/ingestion-leads/:id/{take|close|reassign} */
export async function POST(req: NextRequest, context: AppRouteContext) {
  return withLibraryOps(req, async (access) => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    const action = (await getStringRouteParam(context, "action")) ?? "";
    if (!id) throw new AccessError(400, "无效的待办 ID");
    if (!(LEAD_ACTIONS as readonly string[]).includes(action))
      throw new AccessError(404, "未知操作");
    const lead = await performLeadAction(
      access,
      id,
      action as LeadAction,
      await req.json().catch(() => ({})),
    );
    return NextResponse.json(
      { id: String(lead.id), status: lead.status },
      { headers: PRIVATE_HEADERS },
    );
  });
}
