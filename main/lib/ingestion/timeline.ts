import type { RunStatus, TaskApproval, TaskDetail, TaskOperation, TaskQuestion } from "@/components/ingestion/types";

/** done 已发生；now 正在等人或正在处理；stopped 被拒绝或取消；todo 还没发生 */
export type TimelineState = "done" | "now" | "stopped" | "todo";

export type TimelineNode = { key: string; state: TimelineState } & (
  | { kind: "created"; at: string; by: string }
  | { kind: "files"; at: string; count: number; failed: number }
  | { kind: "session"; at: string; by: string | null }
  | { kind: "question"; at: string; question: TaskQuestion }
  | { kind: "approval"; at: string; approval: TaskApproval }
  /** 写入与它的提案合成一个节点；approval 为 null 时提案不在最近的审批列表里 */
  | { kind: "write"; at: string; operation: TaskOperation; approval: TaskApproval | null }
  | { kind: "report"; at: string; version: number; reportKind: "final" | "draft"; generating: boolean }
  | { kind: "end"; at: string; by: string | null; outcome: "completed" | "cancelled" }
  | { kind: "working" }
  | { kind: "error"; message: string | null }
  | { kind: "next" }
);

type TimelineTask = Pick<
  TaskDetail,
  "createdAt" | "createdByName" | "status" | "closed" | "completedAt" | "cancelledAt" | "files" | "events" | "approvals" | "questions" | "operations"
>;
type TimelineRun = { status: RunStatus; last_error: string | null } | null;
type TimelineReport = { version: number; kind: "final" | "draft"; status: string; createdAt: string } | null;

const APPROVAL_DONE = new Set(["authorized", "applying", "approved"]);

/** 右栏时间线：按时间排列任务里程碑，进行中 / 异常 / 下一步固定在末尾 */
export function buildTimeline(task: TimelineTask, run: TimelineRun, report: TimelineReport): TimelineNode[] {
  const eventOf = (type: string) => task.events.find((e) => e.operationType === type);
  const dated: Extract<TimelineNode, { at: string }>[] = [
    { key: "created", kind: "created", state: "done", at: task.createdAt, by: task.createdByName },
    {
      key: "files",
      kind: "files",
      state: "done",
      at: task.files.reduce((min, f) => (f.createdAt < min ? f.createdAt : min), task.files[0]?.createdAt ?? task.createdAt),
      count: task.files.length,
      failed: task.files.filter((f) => f.status === "FAILED").length,
    },
  ];

  const session = eventOf("session_started");
  if (session) dated.push({ key: "session", kind: "session", state: "done", at: session.createdAt, by: session.operator });

  for (const question of task.questions)
    dated.push({
      key: `question:${question.id}`,
      kind: "question",
      state: question.status === "pending" ? "now" : question.status === "answered" ? "done" : "stopped",
      at: question.createdAt,
      question,
    });
  // 已写入的提案并进写入节点，只单独列出待审批、被拒绝或未写入的提案
  const written = new Set(task.operations.map((o) => o.approvalId));
  for (const approval of task.approvals.filter((a) => !written.has(a.id)))
    dated.push({
      key: `approval:${approval.id}`,
      kind: "approval",
      state: approval.status === "pending" ? "now" : APPROVAL_DONE.has(approval.status) ? "done" : "stopped",
      at: approval.createdAt,
      approval,
    });
  for (const operation of task.operations)
    dated.push({
      key: `write:${operation.id}`,
      kind: "write",
      state: "done",
      at: operation.committedAt,
      operation,
      approval: task.approvals.find((a) => a.id === operation.approvalId) ?? null,
    });

  if (report)
    dated.push({
      key: "report",
      kind: "report",
      state: "done",
      at: report.createdAt,
      version: report.version,
      reportKind: report.kind,
      generating: report.status === "generating",
    });

  const endAt = task.status === "COMPLETED" ? task.completedAt : task.status === "CANCELLED" ? task.cancelledAt : null;
  if (endAt) {
    const outcome = task.status === "COMPLETED" ? "completed" : "cancelled";
    dated.push({ key: "end", kind: "end", state: outcome === "completed" ? "done" : "stopped", at: endAt, by: eventOf(outcome)?.operator ?? null, outcome });
  }

  const nodes: TimelineNode[] = dated.sort((a, b) => a.at.localeCompare(b.at));
  if (task.closed) return nodes;
  if (run?.status === "running") nodes.push({ key: "working", kind: "working", state: "now" });
  if (run?.status === "failed" || run?.status === "interrupted")
    nodes.push({ key: "error", kind: "error", state: "now", message: run.last_error });
  nodes.push({ key: "next", kind: "next", state: "todo" });
  return nodes;
}
