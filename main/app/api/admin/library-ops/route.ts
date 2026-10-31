import { datasetWhere,loadAdminAccess } from "@/lib/admin/access";
import { PRIVATE_HEADERS,can,withLibraryOps } from "@/lib/library/ops-access";
import { prisma } from "@/lib/prisma";
import { NextRequest,NextResponse } from "next/server";

/** Current user's Library ops capabilities and sidebar badge counts. */
export async function GET(req: NextRequest) {
  return withLibraryOps(req, async (access) => {
    const scoped = await loadAdminAccess(access.userId);
    const datasets = scoped.isPlatformAdmin ? [] : await prisma.cantonese_categories.findMany({ where: datasetWhere(scoped, "manage"), select: { name: true } });
    const review = can(access, "contribution_review");
    const assignee = can(access, "ingestion_assignee");
    const [pendingInitialReview, myOpenLeads, openContactRequests, myWaitingTasks] =
      await prisma.$transaction([
        prisma.contribution_applications.count({
          where: review ? { status: "PENDING_INITIAL_REVIEW" } : { id: -1 },
        }),
        prisma.ingestion_leads.count({
          where: assignee
            ? { assignee_id: access.userId, status: "PENDING_OWNER_ACCEPTANCE" }
            : { id: -1 },
        }),
        prisma.dataset_contact_requests.count({
          where: review ? { status: "OPEN", ...(scoped.isPlatformAdmin ? {} : { dataset_name: { in: datasets.map(d => d.name) } }) } : { id: -1 },
        }),
        // 等待负责人审批或回答 Agent 提问的任务
        prisma.ingestion_tasks.count({
          where: assignee
            ? {
                assignee_id: access.userId,
                status: "IN_PROGRESS",
                run: { status: { in: ["waiting_approval", "waiting_input"] } },
              }
            : { id: -1 },
        }),
      ]);
    return NextResponse.json(
      {
        isAdmin: access.isAdmin,
        actions: access.actions,
        counts: { pendingInitialReview, myOpenLeads, openContactRequests, myWaitingTasks },
      },
      { headers: PRIVATE_HEADERS },
    );
  });
}
