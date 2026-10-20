import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PRIVATE_HEADERS, can, withLibraryOps } from "@/lib/library/ops-access";

/** Current user's Library ops capabilities and sidebar badge counts. */
export async function GET(req: NextRequest) {
  return withLibraryOps(req, async (access) => {
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
          where: review ? { status: "OPEN" } : { id: -1 },
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
