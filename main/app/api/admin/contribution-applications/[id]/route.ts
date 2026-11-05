import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { AppRouteContext } from "@/lib/app-route-context";
import { getStringRouteParam } from "@/lib/app-route-context";
import { parseBigIntId } from "@/lib/services/corpus-collection";
import { AccessError } from "@/lib/services/submission-access";
import { availableActions } from "@/lib/library/application-workflow";
import {
  PRIVATE_HEADERS,
  requireCapability,
  withLibraryOps,
} from "@/lib/library/ops-access";
import {
  serializeApplication,
  userNames,
} from "@/lib/library/contribution-service";

export async function GET(req: NextRequest, context: AppRouteContext) {
  return withLibraryOps(req, async (access) => {
    requireCapability(access, "contribution_review");
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    if (!id) throw new AccessError(400, "无效的申请 ID");
    const application = await prisma.contribution_applications.findUnique({
      where: { id },
      include: {
        events: { orderBy: [{ created_at: "asc" }, { id: "asc" }] },
        ingestionLead: true,
      },
    });
    if (!application) throw new AccessError(404, "申请不存在");
    const lead = application.ingestionLead;
    const names = await userNames([
      application.current_handler_id,
      lead?.assignee_id,
      ...application.events.map((e) => e.operator_id),
      ...application.events.flatMap((e) => {
        const p = e.payload as Record<string, unknown>;
        return [p.handlerId, p.assigneeId].filter(
          (v): v is string => typeof v === "string",
        );
      }),
    ]);
    return NextResponse.json(
      {
        application: serializeApplication(application, names),
        events: application.events.map((e) => ({
          id: String(e.id),
          operationType: e.operation_type,
          operatorId: e.operator_id,
          operatorName: e.operator_id ? (names[e.operator_id] ?? e.operator_id) : null,
          operatorRole: e.operator_role,
          fromStatus: e.from_status,
          toStatus: e.to_status,
          note: e.note,
          payload: e.payload,
          createdAt: e.created_at.toISOString(),
        })),
        lead: lead
          ? {
              id: String(lead.id),
              leadNo: lead.lead_no,
              status: lead.status,
              assigneeId: lead.assignee_id,
              assigneeName: names[lead.assignee_id] ?? lead.assignee_id,
              priority: lead.priority,
            }
          : null,
        userNames: names,
        availableActions: availableActions(application.status, access.isAdmin),
      },
      { headers: PRIVATE_HEADERS },
    );
  });
}
