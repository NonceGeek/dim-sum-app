import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AccessError } from "@/lib/services/submission-access";
import {
  ACTION_EVENT,
  ApplicationAction,
  LeadAction,
  formatSerial,
  leadTransition,
  transition,
} from "./application-workflow";
import {
  ContributionApplicationInput,
  DatasetContactRequestInput,
} from "./options";
import {
  LibraryOpsAccess,
  assertUserHasCapability,
  requireCapability,
} from "./ops-access";
import {
  PUBLIC_SUBMISSION_LIMIT,
  PUBLIC_SUBMISSION_WINDOW_MS,
} from "./submission-guard";

/*
 * Assignment never notifies anyone outside the system: this module only writes
 * database rows (application, ingestion lead, history). Do not add email, SMS,
 * IM or webhook calls here (PRD #452).
 */

type Tx = Prisma.TransactionClient;

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function nextSerial(
  tx: Tx,
  prefix: "CA" | "IL",
  now: Date,
): Promise<string> {
  const head = formatSerial(prefix, now, 0).slice(0, -3);
  const count =
    prefix === "CA"
      ? await tx.contribution_applications.count({
          where: { application_no: { startsWith: head } },
        })
      : await tx.ingestion_leads.count({
          where: { lead_no: { startsWith: head } },
        });
  return formatSerial(prefix, now, count + 1);
}

/** Retries when two submissions race for the same daily serial. */
async function withSerialRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (!isUniqueViolation(error) || attempt >= 4) throw error;
    }
  }
}

async function assertUnderLimit(
  count: () => Promise<number>,
) {
  if ((await count()) >= PUBLIC_SUBMISSION_LIMIT)
    throw new AccessError(429, "提交过于频繁，请稍后再试");
}

export async function createContributionApplication(
  input: ContributionApplicationInput,
  meta: { ipHash: string; userId?: string | null },
) {
  const since = new Date(Date.now() - PUBLIC_SUBMISSION_WINDOW_MS);
  await assertUnderLimit(() =>
    prisma.contribution_applications.count({
      where: { submitter_ip_hash: meta.ipHash, created_at: { gte: since } },
    }),
  );
  return withSerialRetry(() =>
    prisma.$transaction(async (tx) => {
      const now = new Date();
      const application = await tx.contribution_applications.create({
        data: {
          application_no: await nextSerial(tx, "CA", now),
          contribution_kind: input.contributionKind,
          contributor_type: input.contributorType,
          contact_name: input.contactName,
          contact_email: input.contactEmail,
          organization_name: input.organizationName,
          contact_role: input.contactRole,
          region: input.region,
          other_contact: input.otherContact,
          dataset_name: input.datasetName,
          short_description: input.shortDescription,
          modalities: input.modalities,
          use_case: input.useCase,
          scale_description: input.scaleDescription,
          source_collection_method: input.sourceCollectionMethod,
          rights_status: input.rightsStatus,
          rights_holder: input.rightsHolder,
          submitter_authority: input.submitterAuthority,
          intended_access_mode: input.intendedAccessMode,
          license_status: input.licenseStatus,
          license_name_or_url: input.licenseNameOrUrl,
          privacy_status: input.privacyStatus,
          reference_url: input.referenceUrl,
          applicant_note: input.applicantNote,
          declarations: { ...input.declarations, acceptedAt: now.toISOString() },
          locale: input.locale,
          submitter_user_id: meta.userId ?? null,
          submitter_ip_hash: meta.ipHash,
        },
      });
      await tx.contribution_application_events.create({
        data: {
          application_id: application.id,
          operator_id: meta.userId ?? null,
          operator_role: "APPLICANT",
          operation_type: "submit",
          to_status: application.status,
        },
      });
      return application;
    }),
  );
}

export async function createDatasetContactRequest(
  input: DatasetContactRequestInput,
  ipHash: string,
) {
  const since = new Date(Date.now() - PUBLIC_SUBMISSION_WINDOW_MS);
  await assertUnderLimit(() =>
    prisma.dataset_contact_requests.count({
      where: { submitter_ip_hash: ipHash, created_at: { gte: since } },
    }),
  );
  const profile = await prisma.library_dataset_profiles.findFirst({
    where: { dataset_name: input.datasetSlug, listed: true },
    select: { dataset_name: true },
  });
  if (!profile) throw new AccessError(404, "语料集不存在");
  return prisma.dataset_contact_requests.create({
    data: {
      dataset_name: profile.dataset_name,
      request_type: input.requestType,
      contact_name: input.contactName,
      contact_email: input.contactEmail,
      organization_name: input.organizationName,
      message: input.message,
      submitter_ip_hash: ipHash,
    },
  });
}

/* ---------- Review actions ---------- */

const note = z.string().trim().max(2000);
const requiredNote = note.min(1);
const userId = z.string().trim().min(1).max(100);

export const ACTION_SCHEMAS = {
  assign: z.object({ handlerId: userId.optional(), note: note.optional() }),
  "contact-logs": z.object({
    channel: z.enum(["email", "phone", "wechat", "meeting", "other"]),
    contactedAt: z.string().datetime({ offset: true }),
    result: z.string().trim().min(1).max(200),
    note: note.optional(),
  }),
  "request-info": z.object({
    infoTypes: z
      .array(
        z.enum(["rights", "source", "license", "privacy", "data_dictionary", "other"]),
      )
      .min(1),
    note: requiredNote,
    handlerId: userId.optional(),
  }),
  "info-received": z.object({ note: note.optional() }),
  "rights-review": z.object({ note: requiredNote, handlerId: userId }),
  "review-complete": z.object({ note: note.optional() }),
  reject: z.object({
    reasonCategory: z.enum([
      "rights_unclear",
      "privacy_risk",
      "quality",
      "out_of_scope",
      "duplicate",
      "other",
    ]),
    note: requiredNote,
    allowResubmit: z.boolean(),
  }),
  accept: z.object({
    assigneeId: userId,
    priority: z.enum(["normal", "high", "urgent"]),
    targetIngestionType: z.enum(["new_dataset", "supplement_existing", "to_be_confirmed"]),
    proposedDatasetName: z.string().trim().min(1).max(200),
    handoverNote: requiredNote,
    rightsMaterialRequired: z.enum(["yes", "no", "pending"]),
    privacyAssessmentRequired: z.enum(["yes", "no", "pending"]),
  }),
  reopen: z.object({ note: requiredNote }),
} satisfies Record<ApplicationAction, z.ZodTypeAny>;

function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new AccessError(400, "请完整填写必填项");
  return parsed.data;
}

export async function performApplicationAction(
  access: LibraryOpsAccess,
  id: bigint,
  action: ApplicationAction,
  body: unknown,
) {
  requireCapability(access, "contribution_review");
  const input = parseBody(ACTION_SCHEMAS[action], body) as Record<string, any>;
  // Accept allocates a daily lead number; a concurrent accept may collide and retries.
  return withSerialRetry(() => prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM contribution_applications WHERE id = ${id} FOR UPDATE`;
      const current = await tx.contribution_applications.findUnique({
        where: { id },
      });
      if (!current) throw new AccessError(404, "申请不存在");
      const step = transition(action, current.status, access.isAdmin);
      if ("reason" in step) throw new AccessError(409, step.reason);

      const data: Prisma.contribution_applicationsUpdateInput = {
        status: step.to,
      };
      let handlerId: string | undefined;
      if (action === "assign") handlerId = input.handlerId ?? access.userId;
      if (action === "request-info" && input.handlerId) handlerId = input.handlerId;
      if (action === "rights-review") handlerId = input.handlerId;
      if (action === "reopen" || (!current.current_handler_id && step.to === "IN_REVIEW"))
        handlerId ??= access.userId;
      if (handlerId) {
        await assertUserHasCapability(tx, handlerId, "contribution_review");
        data.current_handler_id = handlerId;
      }
      if (action === "reject") data.allow_resubmit = input.allowResubmit;

      let lead: { id: bigint; lead_no: string } | null = null;
      if (action === "accept") {
        await assertUserHasCapability(tx, input.assigneeId, "ingestion_assignee");
        lead = await tx.ingestion_leads.create({
          data: {
            lead_no: await nextSerial(tx, "IL", new Date()),
            contribution_application_id: id,
            assignee_id: input.assigneeId,
            priority: input.priority,
            target_ingestion_type: input.targetIngestionType,
            proposed_dataset_name: input.proposedDatasetName,
            handover_note: input.handoverNote,
            rights_material_required: input.rightsMaterialRequired,
            privacy_assessment_required: input.privacyAssessmentRequired,
            rights_privacy_summary: {
              rightsStatus: current.rights_status,
              rightsHolder: current.rights_holder,
              submitterAuthority: current.submitter_authority,
              licenseStatus: current.license_status,
              licenseNameOrUrl: current.license_name_or_url,
              privacyStatus: current.privacy_status,
              intendedAccessMode: current.intended_access_mode,
            },
            created_by: access.userId,
          },
          select: { id: true, lead_no: true },
        });
      }

      const updated = await tx.contribution_applications.update({
        where: { id },
        data,
      });
      const { note: actionNote, ...payload } = input;
      await tx.contribution_application_events.create({
        data: {
          application_id: id,
          operator_id: access.userId,
          operator_role: access.role,
          operation_type: ACTION_EVENT[action],
          from_status: current.status,
          to_status: updated.status,
          note: actionNote ?? (action === "accept" ? input.handoverNote : null),
          payload: {
            ...payload,
            ...(handlerId && handlerId !== current.current_handler_id
              ? { previousHandlerId: current.current_handler_id, handlerId }
              : {}),
          },
        },
      });
      if (lead)
        await tx.contribution_application_events.create({
          data: {
            application_id: id,
            operator_id: access.userId,
            operator_role: access.role,
            operation_type: "lead_created",
            from_status: updated.status,
            to_status: updated.status,
            payload: {
              leadId: String(lead.id),
              leadNo: lead.lead_no,
              assigneeId: input.assigneeId,
              externalNotification: false,
            },
          },
        });
      return { application: updated, lead };
    },
    { timeout: 15000 },
  ));
}

/* ---------- Ingestion lead actions ---------- */

export const LEAD_ACTION_SCHEMAS = {
  take: z.object({ note: note.optional() }),
  close: z.object({ note: requiredNote }),
  reassign: z.object({ assigneeId: userId, note: note.optional() }),
} satisfies Record<LeadAction, z.ZodTypeAny>;

export async function performLeadAction(
  access: LibraryOpsAccess,
  id: bigint,
  action: LeadAction,
  body: unknown,
) {
  requireCapability(access, "ingestion_assignee");
  const input = parseBody(LEAD_ACTION_SCHEMAS[action], body) as Record<string, any>;
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM ingestion_leads WHERE id = ${id} FOR UPDATE`;
    const lead = await tx.ingestion_leads.findUnique({ where: { id } });
    if (!lead) throw new AccessError(404, "待办不存在");
    const step = leadTransition(action, lead.status, {
      isAssignee: lead.assignee_id === access.userId,
      isAdmin: access.isAdmin,
    });
    if ("reason" in step) throw new AccessError(409, step.reason);
    const data: Prisma.ingestion_leadsUpdateInput = { status: step.to };
    if (action === "take") data.accepted_at = new Date();
    if (action === "close") {
      data.closed_at = new Date();
      data.closing_note = input.note;
    }
    if (action === "reassign") {
      await assertUserHasCapability(tx, input.assigneeId, "ingestion_assignee");
      data.assignee_id = input.assigneeId;
      data.accepted_at = null;
    }
    const updated = await tx.ingestion_leads.update({ where: { id }, data });
    await tx.contribution_application_events.create({
      data: {
        application_id: lead.contribution_application_id,
        operator_id: access.userId,
        operator_role: access.role,
        operation_type: `lead_${action}`,
        note: input.note ?? null,
        payload: {
          leadId: String(lead.id),
          leadNo: lead.lead_no,
          fromLeadStatus: lead.status,
          toLeadStatus: updated.status,
          ...(action === "reassign"
            ? { previousAssigneeId: lead.assignee_id, assigneeId: input.assigneeId }
            : {}),
        },
      },
    });
    return updated;
  });
}

/* ---------- Serialization ---------- */

export async function userNames(ids: Array<string | null | undefined>) {
  const unique = [...new Set(ids.filter((v): v is string => !!v))];
  if (!unique.length) return {} as Record<string, string>;
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, email: true },
  });
  return Object.fromEntries(
    users.map((u) => [u.id, u.name || u.email || u.id]),
  ) as Record<string, string>;
}

export function serializeApplication(
  a: Prisma.contribution_applicationsGetPayload<object>,
  names: Record<string, string>,
) {
  return {
    id: String(a.id),
    applicationNo: a.application_no,
    contributionKind: a.contribution_kind,
    contributorType: a.contributor_type,
    contactName: a.contact_name,
    contactEmail: a.contact_email,
    organizationName: a.organization_name,
    contactRole: a.contact_role,
    region: a.region,
    otherContact: a.other_contact,
    datasetName: a.dataset_name,
    shortDescription: a.short_description,
    modalities: a.modalities,
    useCase: a.use_case,
    scaleDescription: a.scale_description,
    sourceCollectionMethod: a.source_collection_method,
    rightsStatus: a.rights_status,
    rightsHolder: a.rights_holder,
    submitterAuthority: a.submitter_authority,
    intendedAccessMode: a.intended_access_mode,
    licenseStatus: a.license_status,
    licenseNameOrUrl: a.license_name_or_url,
    privacyStatus: a.privacy_status,
    referenceUrl: a.reference_url,
    applicantNote: a.applicant_note,
    status: a.status,
    currentHandlerId: a.current_handler_id,
    currentHandlerName: a.current_handler_id
      ? (names[a.current_handler_id] ?? a.current_handler_id)
      : null,
    allowResubmit: a.allow_resubmit,
    createdAt: a.created_at.toISOString(),
    updatedAt: a.updated_at.toISOString(),
  };
}
