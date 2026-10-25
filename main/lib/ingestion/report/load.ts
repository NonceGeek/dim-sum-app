import { prisma } from "@/lib/prisma";
import { getObjectText, listObjectKeys } from "../oss";
import type {
  LineageChange,
  LineageRecord,
  ManifestFile,
  RawApproval,
  RawQuestionGroup,
  RawReportInput,
} from "./types";

/** 与 corpus-control lineagePathsOf 相同：output/records.v2.jsonl → output/records.v2.changes.jsonl 等 */
export function lineagePathsOf(records: string) {
  const stem = records.replace(/\.jsonl$/, "");
  return {
    changes: `${stem}.changes.jsonl`,
    manifest: `${stem}.manifest.json`,
    snapshot: `${stem}.lineage-snapshot.json`,
  };
}

export function parseJsonl<T>(text: string | null): T[] | null {
  if (text === null) return null;
  const rows: T[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line) as T);
    } catch {
      // 损坏的行跳过；完整性以 records_hash 为准
    }
  }
  return rows;
}

function parseJson<T>(text: string | null): T | null {
  if (text === null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function names(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  const users = unique.length
    ? await prisma.user.findMany({
        where: { id: { in: unique } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const byId = Object.fromEntries(users.map((u) => [u.id, u.name || u.email || u.id]));
  return (id: string) => byId[id] ?? id;
}

/** 读文件失败不中断报告：缺失的部分在报告中降级显示 */
const readText = (key: string) => getObjectText(key).catch(() => null);

export async function loadReportInput(taskId: bigint): Promise<RawReportInput> {
  const task = await prisma.ingestion_tasks.findUniqueOrThrow({
    where: { id: taskId },
    include: {
      files: { orderBy: { path: "asc" } },
      operations: { include: { records: { select: { corpus_id: true, record_row: true } } } },
      run: {
        select: {
          approvals: { orderBy: { created_at: "asc" } },
          questions: { orderBy: { created_at: "asc" } },
        },
      },
    },
  });
  const prefix = task.workspace_prefix;
  const approvals = task.run?.approvals ?? [];
  const name = await names([
    task.assignee_id,
    task.created_by,
    ...task.operations.map((o) => o.approved_by),
    ...approvals.flatMap((a) => (a.decided_by ? [a.decided_by] : [])),
  ]);

  const operations = await Promise.all(
    task.operations.map(async (o) => {
      const paths = lineagePathsOf(o.records_path);
      const [records, changes, manifest] = await Promise.all([
        readText(prefix + o.records_path),
        readText(prefix + paths.changes),
        readText(prefix + paths.manifest),
      ]);
      const manifestJson = parseJson<{ files: ManifestFile[]; unchecked_total?: number }>(manifest);
      return {
        id: o.id,
        approvalId: o.approval_id,
        proposalId: o.proposal_id,
        recordsPath: o.records_path,
        recordsHash: o.records_hash,
        committedAt: o.committed_at.toISOString(),
        approvedBy: name(o.approved_by),
        result: o.result,
        created: o.records.map((r) => ({ corpusId: String(r.corpus_id), row: r.record_row })),
        records: parseJsonl<LineageRecord>(records),
        changes: parseJsonl<LineageChange>(changes),
        manifest: manifestJson?.files ?? null,
        unchecked: manifestJson?.unchecked_total ?? 0,
      };
    }),
  );

  const checkpointKeys = await listObjectKeys(`${prefix}audit/checkpoint-`).catch(() => []);
  const checkpoints = (
    await Promise.all(
      checkpointKeys.map(async (key) =>
        parseJson<{ at: string; summary: string }>(await readText(key)),
      ),
    )
  ).filter((c): c is { at: string; summary: string } => !!c?.at && !!c.summary);

  return {
    task: {
      id: String(task.id),
      taskNo: task.task_no,
      title: task.title,
      description: task.description,
      status: task.status,
      targetDatasetName: task.target_dataset_name,
      targetIngestionType: task.target_ingestion_type,
      targetContentAttribute: task.target_content_attribute,
      modalities: task.modalities,
      assignee: name(task.assignee_id),
      creator: name(task.created_by),
      createdAt: task.created_at.toISOString(),
      completedAt: task.completed_at?.toISOString() ?? null,
      cancelledAt: task.cancelled_at?.toISOString() ?? null,
    },
    files: task.files.map((f) => ({
      path: f.path,
      name: f.name,
      size: Number(f.size),
      status: f.status,
    })),
    // 一个审批是一个计划：按步骤展开，每步沿用审批的状态与审批人。
    // 计划格式之前的审批只有一步，kind/input 直接在 proposal 上
    approvals: approvals.flatMap((a): RawApproval[] => {
      type Step = { kind: string; summary: string; input: Record<string, unknown>; expected: unknown };
      const proposal = (a.proposal ?? {}) as Partial<Step> & { steps?: Step[] };
      const result = a.result as { result?: { steps?: unknown[] } & Record<string, unknown> } | null;
      const steps = proposal.steps ?? (proposal.kind ? [proposal as Step] : []);
      const results = proposal.steps ? result?.result?.steps : [result?.result ?? null];
      return steps.map((step, i) => ({
        id: a.id,
        proposalId: a.proposal_id,
        kind: step.kind,
        summary: step.summary,
        input: step.input ?? {},
        status: a.status,
        expected: step.expected,
        result: results?.[i] ?? null,
        decidedBy: a.decided_by ? name(a.decided_by) : null,
        decidedAt: a.decided_at?.toISOString() ?? null,
        // 执行失败时审批人通常不写备注，用执行错误代替
        decisionNote: a.decision_note ?? (a.result as { error?: { message?: string } } | null)?.error?.message ?? null,
        createdAt: a.created_at.toISOString(),
      }));
    }),
    operations,
    questions: (task.run?.questions ?? []).map(
      (q): RawQuestionGroup => ({
        id: q.id,
        toolCallId: q.tool_call_id,
        status: q.status,
        questions: Array.isArray(q.questions) ? (q.questions as RawQuestionGroup["questions"]) : [],
        answers: Array.isArray(q.answers) ? (q.answers as RawQuestionGroup["answers"]) : null,
        createdAt: q.created_at.toISOString(),
        resolvedAt: q.resolved_at?.toISOString() ?? null,
      }),
    ),
    checkpoints,
  };
}
