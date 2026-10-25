import type { DisplayStatus } from "@/lib/ingestion/display-status";
import type { ContentAttribute, IngestionType, TaskModality } from "@/lib/ingestion/task-options";

/* ---------- dim-sum-app /api/admin/ingestion-tasks ---------- */

export type RunSummary = {
  id: string;
  status: RunStatus;
  lastError: string | null;
  pendingApprovals: number;
  pendingQuestions: number;
  updatedAt: string;
};

export type TaskSummary = {
  id: string;
  taskNo: string;
  title: string;
  description: string;
  targetDatasetName: string;
  targetIngestionType: IngestionType;
  /** 新建语料集的类型；补充已有语料集时为 null */
  targetContentAttribute: ContentAttribute | null;
  modalities: TaskModality[];
  sourceCollectionMethod: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  displayStatus: DisplayStatus;
  assigneeId: string;
  assigneeName: string;
  createdByName: string;
  batchId: string;
  run: RunSummary | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskApproval = {
  id: string;
  proposalId: string;
  summary: string | null;
  /** 计划的各步写入，一个审批覆盖全部 */
  steps: { kind: string; summary: string }[];
  expected: Record<string, number>;
  status: ApprovalStatus;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  settledAt: string | null;
  expiresAt: string;
  createdAt: string;
};

export type TaskFile = {
  id: string;
  path: string;
  name: string;
  size: number;
  status: "UPLOADING" | "UPLOADED" | "FAILED";
  uploadedBy: string;
  createdAt: string;
};

export type TaskEvent = {
  id: string;
  operationType: string;
  operator: string | null;
  note: string | null;
  createdAt: string;
};

export type TaskDetail = TaskSummary & {
  lead: { id: string; leadNo: string } | null;
  canUploadFiles: boolean;
  /** 还没开始对话，可以继续修改配置 */
  draft: boolean;
  closed: boolean;
  approvals: TaskApproval[];
  files: TaskFile[];
  events: TaskEvent[];
};

export type TaskRecord = {
  corpusId: string;
  recordRow: number;
  text: string;
  approvalId: string;
  turnId: string | null;
  toolCallId: string | null;
  committedAt: string;
};

export type Provenance = {
  corpusId: string;
  provenance: {
    recordRow: number;
    batchId: string;
    proposalId: string;
    approvalId: string;
    turnId: string | null;
    toolCallId: string | null;
    approvedAt: string;
    committedAt: string;
    approvedBy: { id: string; name: string };
    task: { id: string; taskNo: string; title: string; status: string };
    approval: { status: string; summary: string | null; decidedAt: string | null } | null;
    conversationAvailable: boolean;
  } | null;
};

/* ---------- 入库 Agent /v1/tasks/:taskId（与 corpus-ingest-agent 的 RunView 一致） ---------- */

export type RunStatus =
  | "ready"
  | "running"
  | "waiting_approval"
  | "waiting_input"
  | "failed"
  | "interrupted"
  | "completed"
  | "cancelled";

export type ApprovalStatus =
  | "pending"
  | "authorized"
  | "applying"
  | "approved"
  | "denied"
  | "failed"
  | "expired"
  | "cancelled";

export type Approval = {
  id: string;
  proposal_id: string;
  status: ApprovalStatus;
  turn_id: string | null;
  tool_call_id: string | null;
  expected: Record<string, number>;
  expires_at: string;
  decided_by: string | null;
  decision_note: string | null;
  /** Agent 已按决定续跑 */
  settled_at: string | null;
  proposal: {
    summary: string;
    steps: { kind: string; summary: string; expected: Record<string, number> }[];
  };
};

export type QuestionSpec = {
  id: string;
  header: string;
  question: string;
  options: Array<{ label: string; description?: string }>;
  multiSelect: boolean;
};

export type QuestionAnswer = { question_id: string; selected: string[]; other?: string };

export type QuestionRequest = {
  id: string;
  tool_call_id: string;
  questions: QuestionSpec[];
  answers: QuestionAnswer[] | null;
  status: "pending" | "answered" | "cancelled";
};

export type Subtask = { task_id: string; title: string; status: string };

export type RunView = {
  id: string;
  status: RunStatus;
  revision: number;
  active_turn?: { id: string; status: string };
  context_compaction?: { turn_id: string; phase: string };
  can_resume: boolean;
  resume_blocker: string | null;
  unknown_calls: Array<{ tool_call_id: string; tool_name: string; input: unknown }>;
  can_cancel: boolean;
  cancel_blocker: string | null;
  can_complete: boolean;
  complete_blocker: string | null;
  last_error: string | null;
  approvals: Approval[];
  questions: QuestionRequest[];
  subtasks: Subtask[];
};

/** 溯源深链接的定位目标 */
export type RunTarget = { turnId?: string; toolCallId?: string };
