import { NextRequest, NextResponse } from "next/server";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { parseBigIntId } from "@/lib/services/corpus-collection";
import { AccessError } from "@/lib/services/submission-access";
import { isApplicationAction } from "@/lib/library/application-workflow";
import { PRIVATE_HEADERS, withLibraryOps } from "@/lib/library/ops-access";
import { performApplicationAction } from "@/lib/library/contribution-service";

/**
 * POST /api/admin/contribution-applications/:id/{assign|contact-logs|request-info|
 * info-received|rights-review|review-complete|reject|accept|reopen}
 */
export async function POST(req: NextRequest, context: AppRouteContext) {
  return withLibraryOps(req, async (access) => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    const action = (await getStringRouteParam(context, "action")) ?? "";
    if (!id) throw new AccessError(400, "无效的申请 ID");
    if (!isApplicationAction(action)) throw new AccessError(404, "未知操作");
    const body = await req.json().catch(() => ({}));
    const { application, lead } = await performApplicationAction(
      access,
      id,
      action,
      body,
    );
    return NextResponse.json(
      {
        id: String(application.id),
        status: application.status,
        ...(lead
          ? { ingestionLeadId: String(lead.id), leadNo: lead.lead_no }
          : {}),
      },
      { headers: PRIVATE_HEADERS },
    );
  });
}
