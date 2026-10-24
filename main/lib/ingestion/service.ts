import { posix } from "node:path";
import { after } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { formatSerial } from "@/lib/library/application-workflow";
import {
  LibraryOpsAccess,
  requireCapability,
} from "@/lib/library/ops-access";
import { AccessError } from "@/lib/services/submission-access";
import { agentBaseUrl, callAgent, SESSION_TTL_SECONDS, signSessionToken } from "./agent";
import { DISPLAY_STATUSES, displayStatus } from "./display-status";
import {
  canUploadFiles,
  inputPath,
  isTaskClosed,
  newBatchId,
  TASK_STATUSES,
  workspacePrefix,
} from "./tasks";
import { headObject, signDownload, signNewUpload, uploadMaxBytes, getObjectText } from "./oss";
import {
  generateReport,
  GENERATING_STALE_MS,
  needsFinalReport,
  REPORT_FORMATS,
  type ReportFormat,
  reportFileName,
  scheduleFinalReport,
} from "./report";
import {
  CONTENT_ATTRIBUTES,
  defaultTaskTitle,
  INGESTION_TYPES,
  type IngestionType,
  isDraft,
  normalizeModalities,
  TASK_MODALITIES,
} from "./task-options";

type Tx = Prisma.TransactionClient;
type Task = Prisma.ingestion_tasksGetPayload<object>;

function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new AccessError(400, "请完整填写必填项");
  return parsed.data;
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** 任务负责人与管理员可以操作任务（对话、审批、上传、取消、完成） */
const canOperate = (access: LibraryOpsAccess, task: Pick<Task, "assignee_id">) =>
  access.isAdmin || task.assignee_id === access.userId;

async function loadTask(access: LibraryOpsAccess, id: bigint, db: Tx = prisma) {
  requireCapability(access, "ingestion_assignee");
  const task = await db.ingestion_tasks.findUnique({ where: { id } });
  if (!task) throw new AccessError(404, "任务不存在");
  if (!canOperate(access, task)) throw new AccessError(403, "只有任务负责人可以操作该任务");
  return task;
}

async function lockTask(tx: Tx, access: LibraryOpsAccess, id: bigint) {
  await tx.$queryRaw`SELECT id FROM ingestion_tasks WHERE id = ${id} FOR UPDATE`;
  return loadTask(access, id, tx);
}

function taskEvent(
  tx: Tx,
  access: LibraryOpsAccess,
  task: Pick<Task, "id" | "status">,
  operationType: string,
  extra: { toStatus?: string; note?: string; payload?: Prisma.InputJsonValue } = {},
) {
  return tx.ingestion_task_events.create({
    data: {
      task_id: task.id,
      operator_id: access.userId,
      operator_role: access.role,
      operation_type: operationType,
      from_status: extra.toStatus ? task.status : null,
      to_status: extra.toStatus ?? null,
      note: extra.note ?? null,
      payload: extra.payload ?? {},
    },
  });
}

/* ---------- Create ---------- */

const taskConfigFields = z.object({
  title: z.string().trim().max(200).default(""),
  description: z.string().trim().max(2000).default(""),
  targetIngestionType: z.enum(INGESTION_TYPES),
  targetDatasetName: z.string().trim().min(1).max(200),
  // 新建语料集时必填，补充已有语料集时忽略
  targetContentAttribute: z.enum(CONTENT_ATTRIBUTES).optional(),
  modalities: z.array(z.enum(TASK_MODALITIES)).max(TASK_MODALITIES.length).default([]),
  // 草稿可以先空着；开始智能清洗前由表单要求填写
  sourceCollectionMethod: z.string().trim().max(2000).default(""),
});

const requireContentAttribute = (
  input: { targetIngestionType?: IngestionType; targetContentAttribute?: string },
  ctx: z.RefinementCtx,
) => {
  if (input.targetIngestionType === "new_dataset" && !input.targetContentAttribute)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["targetContentAttribute"] });
};

const taskConfigSchema = taskConfigFields.superRefine(requireContentAttribute);

export const createTaskSchema = taskConfigFields
  .extend({ leadId: z.string().regex(/^\d+$/).optional() })
  .superRefine(requireContentAttribute);

/** 选已有语料集时它必须存在；新建时不能与已有语料集的标识或展示名重名 */
async function assertDatasetTarget(tx: Tx, type: IngestionType, name: string) {
  if (type === "supplement_existing") {
    const existing = await tx.cantonese_categories.findUnique({ where: { name }, select: { name: true } });
    if (!existing) throw new AccessError(400, "所选语料集不存在");
    return;
  }
  const existing = await tx.cantonese_categories.findFirst({
    where: { OR: [{ name }, { nickname: name }] },
    select: { name: true },
  });
  if (existing) throw new AccessError(409, "已有同名语料集，请改为选择已有语料集");
}

function taskConfigData(input: z.infer<typeof taskConfigFields>) {
  return {
    title: input.title || defaultTaskTitle(input.targetDatasetName),
    description: input.description,
    target_ingestion_type: input.targetIngestionType,
    target_dataset_name: input.targetDatasetName,
    target_content_attribute:
      input.targetIngestionType === "new_dataset" ? (input.targetContentAttribute ?? null) : null,
    modalities: normalizeModalities(input.modalities),
    source_collection_method: input.sourceCollectionMethod,
  };
}

async function nextTaskNo(tx: Tx, now: Date) {
  const head = formatSerial("IT", now, 0).slice(0, -3);
  const count = await tx.ingestion_tasks.count({ where: { task_no: { startsWith: head } } });
  return formatSerial("IT", now, count + 1);
}

/**
 * 建任务（草稿），创建人即负责人；带 leadId 时从入库待办创建并回写 ingestion_task_id。
 */
export async function createTask(access: LibraryOpsAccess, body: unknown) {
  requireCapability(access, "ingestion_assignee");
  const input = parseBody(createTaskSchema, body);
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        let lead: { id: bigint } | null = null;
        if (input.leadId) {
          const leadId = BigInt(input.leadId);
          await tx.$queryRaw`SELECT id FROM ingestion_leads WHERE id = ${leadId} FOR UPDATE`;
          const found = await tx.ingestion_leads.findUnique({ where: { id: leadId } });
          if (!found) throw new AccessError(404, "待办不存在");
          if (!access.isAdmin && found.assignee_id !== access.userId)
            throw new AccessError(403, "只有待办被指派人可以创建入库任务");
          if (found.status !== "IN_PROGRESS")
            throw new AccessError(409, "请先接手待办再创建入库任务");
          if (found.ingestion_task_id !== null)
            throw new AccessError(409, "该待办已有入库任务");
          lead = found;
        }
        await assertDatasetTarget(tx, input.targetIngestionType, input.targetDatasetName);
        const batchId = newBatchId();
        const task = await tx.ingestion_tasks.create({
          data: {
            task_no: await nextTaskNo(tx, new Date()),
            ...taskConfigData(input),
            assignee_id: access.userId,
            created_by: access.userId,
            batch_id: batchId,
            workspace_prefix: workspacePrefix(batchId),
          },
        });
        if (lead)
          await tx.ingestion_leads.update({
            where: { id: lead.id },
            data: { ingestion_task_id: task.id },
          });
        await taskEvent(tx, access, task, "created", {
          toStatus: task.status,
          payload: { leadId: lead ? String(lead.id) : null },
        });
        return task;
      });
    } catch (error) {
      // 当天编号并发冲突时重试
      if (!isUniqueViolation(error) || attempt >= 4) throw error;
    }
  }
}

/** 修改草稿；开始对话后配置已写进批次说明，不能再改 */
export async function updateTask(access: LibraryOpsAccess, id: bigint, body: unknown) {
  const input = parseBody(taskConfigSchema, body);
  await prisma.$transaction(async (tx) => {
    const task = await lockTask(tx, access, id);
    const run = await tx.corpus_agent_runs.findUnique({
      where: { task_id: id },
      select: { id: true },
    });
    if (!isDraft(task.status, !!run)) throw new AccessError(409, "任务已开始，不能再修改配置");
    await assertDatasetTarget(tx, input.targetIngestionType, input.targetDatasetName);
    await tx.ingestion_tasks.update({
      where: { id },
      data: { ...taskConfigData(input), updated_at: new Date() },
    });
    await taskEvent(tx, access, task, "updated");
  });
  return getTaskDetail(access, id);
}

/* ---------- Files ---------- */

export const signFileSchema = z.object({
  path: z.string().min(1).max(500),
  size: z.number().int().nonnegative(),
});

export async function signFileUpload(access: LibraryOpsAccess, id: bigint, body: unknown) {
  const input = parseBody(signFileSchema, body);
  let path: string;
  try {
    path = inputPath(input.path);
  } catch (error) {
    throw new AccessError(400, (error as Error).message);
  }
  if (input.size > uploadMaxBytes())
    throw new AccessError(400, `单个文件不能超过 ${uploadMaxBytes()} bytes`);
  const task = await prisma.$transaction(async (tx) => {
    const task = await lockTask(tx, access, id);
    const run = await tx.corpus_agent_runs.findUnique({
      where: { task_id: id },
      select: { status: true },
    });
    if (!canUploadFiles(task.status, run?.status ?? null))
      throw new AccessError(409, "任务当前状态不能上传文件");
    const existing = await tx.ingestion_task_files.findUnique({
      where: { task_id_path: { task_id: id, path } },
    });
    if (existing?.status === "UPLOADED")
      throw new AccessError(409, `文件已存在，拒绝覆盖: ${path}`);
    await tx.ingestion_task_files.upsert({
      where: { task_id_path: { task_id: id, path } },
      create: {
        task_id: id,
        path,
        name: posix.basename(path),
        size: BigInt(input.size),
        uploaded_by: access.userId,
      },
      update: {
        size: BigInt(input.size),
        status: "UPLOADING",
        uploaded_by: access.userId,
        updated_at: new Date(),
      },
    });
    return task;
  });
  return { path, ...signNewUpload(`${task.workspace_prefix}${path}`) };
}

export async function completeFileUpload(access: LibraryOpsAccess, id: bigint, body: unknown) {
  const { path } = parseBody(z.object({ path: z.string().min(1) }), body);
  const task = await loadTask(access, id);
  const file = await prisma.ingestion_task_files.findUnique({
    where: { task_id_path: { task_id: id, path } },
  });
  if (!file) throw new AccessError(404, "没有该文件的上传记录");
  if (file.status === "UPLOADED") return file;
  const object = await headObject(`${task.workspace_prefix}${path}`);
  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.ingestion_task_files.update({
      where: { id: file.id },
      data: object
        ? {
            status: "UPLOADED",
            size: BigInt(object.size),
            etag: object.etag,
            updated_at: new Date(),
          }
        : { status: "FAILED", updated_at: new Date() },
    });
    await taskEvent(tx, access, task, object ? "file_uploaded" : "file_upload_failed", {
      payload: { path, size: object?.size ?? null },
    });
    return updated;
  });
  if (!object) throw new AccessError(409, `未找到已上传文件: ${path}`);
  return updated;
}

/* ---------- Lifecycle ---------- */

/**
 * 未开始对话的任务在本地取消；已有会话时交给 Agent，由它中止执行、停 Sandbox
 * 并在同一事务内把任务置为 CANCELLED。两边都先锁任务行，与 Agent 懒建会话串行。
 */
export async function cancelTask(access: LibraryOpsAccess, id: bigint) {
  const local = await prisma.$transaction(async (tx) => {
    const task = await lockTask(tx, access, id);
    if (task.status === "CANCELLED") return task;
    if (task.status === "COMPLETED") throw new AccessError(409, "任务已完成，不能取消");
    const run = await tx.corpus_agent_runs.findUnique({
      where: { task_id: id },
      select: { id: true },
    });
    if (run) return null;
    await taskEvent(tx, access, task, "cancelled", { toStatus: "CANCELLED" });
    return tx.ingestion_tasks.update({
      where: { id },
      data: { status: "CANCELLED", cancelled_at: new Date(), updated_at: new Date() },
    });
  });
  if (!local)
    await callAgent({ userId: access.userId, taskId: String(id) }, "/cancel", {
      method: "POST",
    });
  return getTaskDetail(access, id);
}

export async function completeTask(access: LibraryOpsAccess, id: bigint) {
  const task = await loadTask(access, id);
  const run = await prisma.corpus_agent_runs.findUnique({
    where: { task_id: id },
    select: { id: true },
  });
  if (!run) throw new AccessError(409, "任务尚未开始对话，不能完成");
  if (task.status !== "COMPLETED")
    await callAgent({ userId: access.userId, taskId: String(id) }, "/complete", {
      method: "POST",
    });
  return getTaskDetail(access, id);
}

/* ---------- Approvals ---------- */

export const decideApprovalSchema = z.object({
  decision: z.enum(["approve", "deny"]),
  note: z.string().trim().max(2000).optional(),
});

function serializeApproval(
  approval: Prisma.corpus_agent_approvalsGetPayload<object>,
  names: Record<string, string> = {},
) {
  const proposal = approval.proposal as { kind?: string; summary?: string } | null;
  return {
    id: approval.id,
    proposalId: approval.proposal_id,
    kind: proposal?.kind ?? null,
    summary: proposal?.summary ?? null,
    expected: approval.expected,
    status: approval.status,
    decidedBy: approval.decided_by,
    decidedByName: approval.decided_by
      ? (names[approval.decided_by] ?? approval.decided_by)
      : null,
    decidedAt: approval.decided_at?.toISOString() ?? null,
    decisionNote: approval.decision_note,
    settledAt: approval.settled_at?.toISOString() ?? null,
    expiresAt: approval.expires_at.toISOString(),
    createdAt: approval.created_at.toISOString(),
  };
}

/**
 * 审批入库提案：只在这里写决定（批准为 authorized，拒绝为 denied）。入库 Agent 的数据库角色
 * 不能写这些字段，它只能执行已批准的提案、按拒绝续跑——浏览器随后调 Agent 的
 * POST /v1/tasks/:id/approvals/:approvalId/execute。
 * 加锁顺序与 Agent 一致：任务 → 会话 → 审批。
 */
export async function decideApproval(
  access: LibraryOpsAccess,
  id: bigint,
  approvalId: string,
  body: unknown,
) {
  const input = parseBody(decideApprovalSchema, body);
  return prisma.$transaction(async (tx) => {
    const task = await lockTask(tx, access, id);
    if (isTaskClosed(task.status)) throw new AccessError(409, "任务已结束，不能审批");
    const run = await tx.corpus_agent_runs.findUnique({
      where: { task_id: id },
      select: { id: true },
    });
    if (!run) throw new AccessError(404, "审批不存在");
    await tx.$queryRaw`SELECT id FROM corpus_agent_runs WHERE id = ${run.id} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM corpus_agent_approvals WHERE id = ${approvalId} FOR UPDATE`;
    const approval = await tx.corpus_agent_approvals.findUnique({ where: { id: approvalId } });
    if (!approval || approval.run_id !== run.id) throw new AccessError(404, "审批不存在");
    if (approval.status !== "pending") throw new AccessError(409, "审批已处理");
    if (approval.expires_at <= new Date())
      throw new AccessError(409, "审批已过期，请让 Agent 重新提案");
    const status = input.decision === "approve" ? "authorized" : "denied";
    const updated = await tx.corpus_agent_approvals.update({
      where: { id: approvalId },
      data: {
        status,
        decided_by: access.userId,
        decided_at: new Date(),
        decision_note: input.note ?? null,
      },
    });
    const proposal = approval.proposal as { kind?: string; summary?: string } | null;
    await taskEvent(tx, access, task, `approval_${status}`, {
      note: input.note,
      payload: {
        approvalId,
        proposalId: approval.proposal_id,
        kind: proposal?.kind ?? null,
        summary: proposal?.summary ?? null,
        expected: approval.expected as Prisma.InputJsonValue,
      },
    });
    return serializeApproval(updated);
  });
}

/** 签发浏览器直连 Agent 用的短期会话 token；已结束的任务仍可查看历史 */
export async function issueSession(access: LibraryOpsAccess, id: bigint) {
  await loadTask(access, id);
  const token = await signSessionToken({ userId: access.userId, taskId: String(id) });
  return {
    token,
    expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString(),
    agentBaseUrl: agentBaseUrl(),
  };
}

/* ---------- Read ---------- */

const runSummarySelect = {
  id: true,
  status: true,
  last_error: true,
  updated_at: true,
  _count: {
    select: {
      approvals: { where: { status: { in: ["pending", "authorized", "applying"] } } },
      questions: { where: { status: "pending" } },
    },
  },
} satisfies Prisma.corpus_agent_runsSelect;

type RunSummary = Prisma.corpus_agent_runsGetPayload<{ select: typeof runSummarySelect }>;

function serializeTask(task: Task, run: RunSummary | null, names: Record<string, string>) {
  const status = displayStatus(task.status, run?.status ?? null);
  return {
    id: String(task.id),
    taskNo: task.task_no,
    title: task.title,
    description: task.description,
    targetDatasetName: task.target_dataset_name,
    targetIngestionType: task.target_ingestion_type,
    targetContentAttribute: task.target_content_attribute,
    modalities: task.modalities,
    sourceCollectionMethod: task.source_collection_method,
    status: task.status,
    displayStatus: status,
    displayStatusLabel: DISPLAY_STATUSES[status],
    assigneeId: task.assignee_id,
    assigneeName: names[task.assignee_id] ?? task.assignee_id,
    createdBy: task.created_by,
    createdByName: names[task.created_by] ?? task.created_by,
    batchId: task.batch_id,
    run: run && {
      id: run.id,
      status: run.status,
      lastError: run.last_error,
      pendingApprovals: run._count.approvals,
      pendingQuestions: run._count.questions,
      updatedAt: run.updated_at.toISOString(),
    },
    completedAt: task.completed_at?.toISOString() ?? null,
    cancelledAt: task.cancelled_at?.toISOString() ?? null,
    createdAt: task.created_at.toISOString(),
    updatedAt: task.updated_at.toISOString(),
  };
}

async function userNames(ids: string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return {} as Record<string, string>;
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, email: true },
  });
  return Object.fromEntries(users.map((u) => [u.id, u.name || u.email || u.id]));
}

export async function listTasks(access: LibraryOpsAccess, params: URLSearchParams) {
  requireCapability(access, "ingestion_assignee");
  // 只有管理员可以看他人的任务
  const all = access.isAdmin && params.get("assignee") === "all";
  const status = params.get("status");
  const q = params.get("q")?.trim();
  const dataset = params.get("dataset")?.trim();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize")) || 20));
  const where: Prisma.ingestion_tasksWhereInput = {
    ...(all ? {} : { assignee_id: access.userId }),
    ...(status && (TASK_STATUSES as readonly string[]).includes(status) ? { status } : {}),
    ...(dataset ? { target_dataset_name: dataset } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { task_no: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.ingestion_tasks.findMany({
      where,
      include: { run: { select: runSummarySelect } },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.ingestion_tasks.count({ where }),
  ]);
  const names = await userNames(rows.flatMap((r) => [r.assignee_id, r.created_by]));
  return {
    items: rows.map(({ run, ...task }) => serializeTask(task, run, names)),
    total,
    page,
    pageSize,
  };
}

export async function getTaskDetail(access: LibraryOpsAccess, id: bigint) {
  await loadTask(access, id);
  const task = await prisma.ingestion_tasks.findUniqueOrThrow({
    where: { id },
    include: {
      run: { select: runSummarySelect },
      files: { orderBy: [{ path: "asc" }] },
      events: { orderBy: [{ created_at: "desc" }, { id: "desc" }], take: 50 },
      lead: { select: { id: true, lead_no: true } },
    },
  });
  const { run, files, events, lead, ...row } = task;
  const approvals = run
    ? await prisma.corpus_agent_approvals.findMany({
        where: { run_id: run.id },
        orderBy: [{ created_at: "desc" }],
        take: 20,
      })
    : [];
  const names = await userNames([
    row.assignee_id,
    row.created_by,
    ...files.map((f) => f.uploaded_by),
    ...events.flatMap((e) => (e.operator_id ? [e.operator_id] : [])),
    ...approvals.flatMap((a) => (a.decided_by ? [a.decided_by] : [])),
  ]);
  const closed = isTaskClosed(row.status);
  if (closed) maybeScheduleFinalReport(id, access.userId);
  return {
    ...serializeTask(row, run, names),
    lead: lead && { id: String(lead.id), leadNo: lead.lead_no },
    canUploadFiles: canUploadFiles(row.status, run?.status ?? null),
    draft: isDraft(row.status, !!run),
    closed,
    approvals: approvals.map((a) => serializeApproval(a, names)),
    files: files.map((f) => ({
      id: String(f.id),
      path: f.path,
      name: f.name,
      size: Number(f.size),
      status: f.status,
      uploadedBy: names[f.uploaded_by] ?? f.uploaded_by,
      createdAt: f.created_at.toISOString(),
      updatedAt: f.updated_at.toISOString(),
    })),
    events: events.map((e) => ({
      id: String(e.id),
      operationType: e.operation_type,
      operator: e.operator_id ? (names[e.operator_id] ?? e.operator_id) : null,
      fromStatus: e.from_status,
      toStatus: e.to_status,
      note: e.note,
      payload: e.payload,
      createdAt: e.created_at.toISOString(),
    })),
  };
}

/** 可补充的已有语料集，供新建任务时选择 */
export async function listDatasets(access: LibraryOpsAccess) {
  requireCapability(access, "ingestion_assignee");
  const rows = await prisma.cantonese_categories.findMany({
    select: {
      name: true,
      nickname: true,
      content_attribute: true,
      libraryProfile: { select: { modalities: true } },
    },
    orderBy: [{ pinned: "desc" }, { sorting: "desc" }, { name: "asc" }],
  });
  return {
    items: rows.map((r) => ({
      name: r.name,
      nickname: r.nickname,
      contentAttribute: r.content_attribute,
      profileModalities: r.libraryProfile?.modalities ?? [],
    })),
  };
}

/** 选中语料集的已有内容条数与媒体组成；只在选中时查，避免列表逐个计数 */
export async function datasetOverview(access: LibraryOpsAccess, name: string) {
  requireCapability(access, "ingestion_assignee");
  const [row] = await prisma.$queryRaw<{ count: number; media_types: string[] }[]>`
    select count(*)::int as count,
      array(select distinct unnest(media_types) from cantonese_corpus_all where category = ${name}) as media_types
    from cantonese_corpus_all where category = ${name}`;
  return { name, count: row.count, mediaTypes: row.media_types };
}

/** 本任务首次创建的语料，按 corpus_id 游标分页 */
export async function listTaskRecords(
  access: LibraryOpsAccess,
  id: bigint,
  params: URLSearchParams,
) {
  await loadTask(access, id);
  const cursor = params.get("cursor");
  const limit = Math.min(100, Math.max(1, Number(params.get("limit")) || 20));
  const rows = await prisma.ingestion_records.findMany({
    where: {
      operation: { task_id: id },
      ...(cursor && /^\d+$/.test(cursor) ? { corpus_id: { gt: BigInt(cursor) } } : {}),
    },
    include: {
      corpus: { select: { data: true } },
      operation: {
        select: {
          id: true,
          approval_id: true,
          proposal_id: true,
          turn_id: true,
          tool_call_id: true,
          committed_at: true,
        },
      },
    },
    orderBy: { corpus_id: "asc" },
    take: limit + 1,
  });
  const items = rows.slice(0, limit).map((r) => ({
    corpusId: String(r.corpus_id),
    recordRow: r.record_row,
    text: r.corpus.data.slice(0, 80),
    operationId: r.operation.id,
    approvalId: r.operation.approval_id,
    proposalId: r.operation.proposal_id,
    turnId: r.operation.turn_id,
    toolCallId: r.operation.tool_call_id,
    committedAt: r.operation.committed_at.toISOString(),
  }));
  return { items, nextCursor: rows.length > limit ? items.at(-1)!.corpusId : null };
}

/** 单条语料的入库溯源；任何入库运营都可查（审计用途） */
export async function corpusProvenance(access: LibraryOpsAccess, corpusId: bigint) {
  requireCapability(access, "ingestion_assignee");
  const record = await prisma.ingestion_records.findUnique({
    where: { corpus_id: corpusId },
    include: {
      operation: {
        include: {
          task: { select: { id: true, task_no: true, title: true, status: true } },
          approver: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  if (!record) return { corpusId: String(corpusId), provenance: null };
  const { operation } = record;
  const approval = await prisma.corpus_agent_approvals.findUnique({
    where: { id: operation.approval_id },
    select: { status: true, proposal: true, decided_at: true },
  });
  const run = await prisma.corpus_agent_runs.findUnique({
    where: { task_id: operation.task_id },
    select: { id: true },
  });
  return {
    corpusId: String(corpusId),
    provenance: {
      recordRow: record.record_row,
      operationId: operation.id,
      batchId: operation.batch_id,
      proposalId: operation.proposal_id,
      approvalId: operation.approval_id,
      turnId: operation.turn_id,
      toolCallId: operation.tool_call_id,
      recordsPath: operation.records_path,
      approvedAt: operation.approved_at.toISOString(),
      committedAt: operation.committed_at.toISOString(),
      approvedBy: {
        id: operation.approver.id,
        name: operation.approver.name || operation.approver.email || operation.approver.id,
      },
      task: {
        id: String(operation.task.id),
        taskNo: operation.task.task_no,
        title: operation.task.title,
        status: operation.task.status,
      },
      approval: approval && {
        status: approval.status,
        summary: (approval.proposal as { summary?: string } | null)?.summary ?? null,
        decidedAt: approval.decided_at?.toISOString() ?? null,
      },
      conversationAvailable: !!run && !!operation.turn_id,
    },
  };
}

/* ---------- Reports ---------- */

const pendingReports = new Set<string>();

/** 任务已结束且没有可用正式报告时在响应后生成；完成、取消与 Agent 侧结束都经过这里 */
function maybeScheduleFinalReport(id: bigint, actor: string) {
  const key = String(id);
  if (pendingReports.has(key)) return;
  pendingReports.add(key);
  after(async () => {
    try {
      if (await needsFinalReport(id)) await scheduleFinalReport(id, actor);
    } finally {
      pendingReports.delete(key);
    }
  });
}

function serializeReport(r: Prisma.ingestion_reportsGetPayload<object>, names: Record<string, string>) {
  const stale =
    r.status === "generating" && Date.now() - r.updated_at.getTime() > GENERATING_STALE_MS;
  return {
    id: String(r.id),
    version: r.version,
    kind: r.kind,
    status: stale ? "failed" : r.status,
    formats: r.formats,
    summary: r.summary,
    error: stale ? "生成中断，请重新生成" : r.error,
    generatedBy: r.generated_by ? (names[r.generated_by] ?? r.generated_by) : null,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

/** 报告列表与最新一份可读报告的 Markdown 正文 */
export async function getTaskReports(access: LibraryOpsAccess, id: bigint) {
  await loadTask(access, id);
  const rows = await prisma.ingestion_reports.findMany({
    where: { task_id: id },
    orderBy: { version: "desc" },
    take: 20,
  });
  const names = await userNames(rows.flatMap((r) => (r.generated_by ? [r.generated_by] : [])));
  const reports = rows.map((r) => serializeReport(r, names));
  const readable = rows.find((r) => r.formats.includes("md"));
  const markdown = readable
    ? await getObjectText(readable.base_path + reportFileName(readable.version, "md")).catch(() => null)
    : null;
  return {
    reports,
    current: readable ? { version: readable.version, kind: readable.kind, markdown } : null,
  };
}

export const regenerateReportSchema = z.object({
  kind: z.enum(["final", "draft"]).default("final"),
  narrative: z.boolean().optional(),
});

/** 重新生成正式报告（任务须已结束）或生成草稿预览；在响应后执行，页面轮询状态 */
export async function regenerateReport(access: LibraryOpsAccess, id: bigint, body: unknown) {
  const task = await loadTask(access, id);
  const { kind, narrative } = parseBody(regenerateReportSchema, body ?? {});
  if (kind === "final" && !isTaskClosed(task.status))
    throw new AccessError(409, "任务结束后才能生成正式报告，结束前请生成草稿");
  const generating = await prisma.ingestion_reports.findFirst({
    where: {
      task_id: id,
      status: "generating",
      updated_at: { gt: new Date(Date.now() - GENERATING_STALE_MS) },
    },
    select: { id: true },
  });
  if (generating) throw new AccessError(409, "报告正在生成，请稍候");
  after(() =>
    generateReport(id, { kind, actor: access.userId, narrative }).catch((error) => {
      console.error(`[ingestion-report] task ${id} failed`, error);
    }),
  );
  return getTaskReports(access, id);
}

/** 报告下载：返回带文件名的临时 URL */
export async function reportDownloadUrl(
  access: LibraryOpsAccess,
  id: bigint,
  version: number,
  format: string,
) {
  const task = await loadTask(access, id);
  if (!(format in REPORT_FORMATS)) throw new AccessError(400, "不支持的格式");
  const row = await prisma.ingestion_reports.findUnique({
    where: { task_id_version: { task_id: id, version } },
  });
  if (!row || !row.formats.includes(format)) throw new AccessError(404, "报告文件不存在");
  const file = reportFileName(version, format as ReportFormat);
  return signDownload(row.base_path + file, `${task.task_no}-入库报告-${file}`);
}
