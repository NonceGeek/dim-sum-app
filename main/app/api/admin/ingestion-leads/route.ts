import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LEAD_STATUSES } from "@/lib/library/application-workflow";
import {
  PRIVATE_HEADERS,
  requireCapability,
  withLibraryOps,
} from "@/lib/library/ops-access";
import { userNames } from "@/lib/library/contribution-service";

/** GET /api/admin/ingestion-leads?assignee=me|all&status= */
export async function GET(req: NextRequest) {
  return withLibraryOps(req, async (access) => {
    requireCapability(access, "ingestion_assignee");
    const params = new URL(req.url).searchParams;
    // Only admins may look beyond their own leads.
    const all = access.isAdmin && params.get("assignee") === "all";
    const status = params.get("status");
    const page = Math.max(1, Number(params.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize")) || 20));
    const where: Prisma.ingestion_leadsWhereInput = {
      ...(all ? {} : { assignee_id: access.userId }),
      ...(status && (LEAD_STATUSES as readonly string[]).includes(status)
        ? { status }
        : {}),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.ingestion_leads.findMany({
        where,
        include: {
          application: {
            select: {
              id: true,
              application_no: true,
              dataset_name: true,
              contact_name: true,
              contact_email: true,
              organization_name: true,
              other_contact: true,
              region: true,
              scale_description: true,
              modalities: true,
            },
          },
        },
        orderBy: [{ created_at: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.ingestion_leads.count({ where }),
    ]);
    const names = await userNames(rows.flatMap((r) => [r.assignee_id, r.created_by]));
    return NextResponse.json(
      {
        items: rows.map((r) => ({
          id: String(r.id),
          leadNo: r.lead_no,
          status: r.status,
          priority: r.priority,
          targetIngestionType: r.target_ingestion_type,
          proposedDatasetName: r.proposed_dataset_name,
          handoverNote: r.handover_note,
          rightsMaterialRequired: r.rights_material_required,
          privacyAssessmentRequired: r.privacy_assessment_required,
          rightsPrivacySummary: r.rights_privacy_summary,
          closingNote: r.closing_note,
          ingestionTaskId: r.ingestion_task_id,
          assigneeId: r.assignee_id,
          assigneeName: names[r.assignee_id] ?? r.assignee_id,
          createdByName: names[r.created_by] ?? r.created_by,
          acceptedAt: r.accepted_at?.toISOString() ?? null,
          closedAt: r.closed_at?.toISOString() ?? null,
          createdAt: r.created_at.toISOString(),
          application: {
            id: String(r.application.id),
            applicationNo: r.application.application_no,
            datasetName: r.application.dataset_name,
            contactName: r.application.contact_name,
            contactEmail: r.application.contact_email,
            organizationName: r.application.organization_name,
            otherContact: r.application.other_contact,
            region: r.application.region,
            scaleDescription: r.application.scale_description,
            modalities: r.application.modalities,
          },
        })),
        total,
        page,
        pageSize,
        canViewAll: access.isAdmin,
      },
      { headers: PRIVATE_HEADERS },
    );
  });
}
