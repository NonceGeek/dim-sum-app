import { posix } from "node:path";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { formatSerial } from "@/lib/library/application-workflow";
import {
  assertUserHasCapability,
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
import { headObject, signNewUpload, uploadMaxBytes } from "./oss";

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

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
  targetDatasetName: z.string().trim().min(1).max(200).optional(),
  assigneeId: z.string().trim().min(1).optional(),
  leadId: z.string().regex(/^\d+$/).optional(),
});

async function nextTaskNo(tx: Tx, now: Date) {
  const head = formatSerial("IT", now, 0).slice(0, -3);
  const count = await tx.ingestion_tasks.count({ where: { task_no: { startsWith: head } } });
  return formatSerial("IT", now, count + 1);
}

/**
 * 建任务；带 leadId 时从入库待办创建并回写 ingestion_task_id。
 * 非管理员只能给自己建任务；预计语料名缺省取待办的 proposed_dataset_name。
 */
export async function createTask(access: LibraryOpsAccess, body: unknown) {
  requireCapability(access, "ingestion_assignee");
  const input = parseBody(createTaskSchema, body);
  const assigneeId = input.assigneeId ?? access.userId;
  if (assigneeId !== access.userId && !access.isAdmin)
    throw new AccessError(403, "仅系统管理员可指派他人");
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        await assertUserHasCapability(tx, assigneeId, "ingestion_assignee");
        let lead: { id: bigint; proposed_dataset_name: string } | null = null;
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
        const targetDatasetName = input.targetDatasetName ?? lead?.proposed_dataset_name;
        if (!targetDatasetName) throw new AccessError(400, "请填写预计语料名");
        const batchId = newBatchId();
        const task = await tx.ingestion_tasks.create({
          data: {
            task_no: await nextTaskNo(tx, new Date()),
            title: input.title,
            description: input.description,
            target_dataset_name: targetDatasetName,
            assignee_id: assigneeId,
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
          payload: { assigneeId, leadId: lead ? String(lead.id) : null },
        });
        return task;
      });
    } catch (error) {
      // 当天编号并发冲突时重试
      if (!isUniqueViolation(error) || attempt >= 4) throw error;
    }
  }
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
      approvals: { where: { status: { in: ["pending", "applying"] } } },
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
  const names = await userNames([
    row.assignee_id,
    row.created_by,
    ...files.map((f) => f.uploaded_by),
    ...events.flatMap((e) => (e.operator_id ? [e.operator_id] : [])),
  ]);
  return {
    ...serializeTask(row, run, names),
    lead: lead && { id: String(lead.id), leadNo: lead.lead_no },
    canUploadFiles: canUploadFiles(row.status, run?.status ?? null),
    closed: isTaskClosed(row.status),
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
