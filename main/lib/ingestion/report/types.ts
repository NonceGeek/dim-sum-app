/**
 * 入库报告 report.v1.json 的结构。数字与清单全部由程序从系统记录生成；
 * 文字导读另由 LLM 撰写并经 validate.ts 校验（见 narrative.ts）。
 * 来源追溯文件的格式见 yue-lint-agent skills/corpus-ingest/references/lineage.md。
 */

export const REPORT_SCHEMA_VERSION = 1;

export type DecisionRef = { question_id?: string; turn_id?: string; approval_id?: string };

export type ChangeOrigin =
  | "rule"
  | "ai_auto"
  | "ai_flagged_human_confirmed"
  | "human_override"
  | "human_rejected_ai"
  | "unexplained";

export type RecordSource = {
  facet: string;
  anchors?: string[];
  segment_id?: string;
  generated?: { op: string; from_facet: string };
};

/** build_records 写的 <records>.changes.jsonl 的一行 */
export type LineageChange = {
  change_id: string;
  row: number;
  src?: string;
  segment_id?: string;
  facet: string;
  field: string;
  before: string;
  after: string;
  kind: string;
  origin: ChangeOrigin;
  evidence?: Record<string, unknown>;
  decision_ref?: DecisionRef;
  note?: string;
};

/** build_records 写的 <records>.manifest.json 的 files[] */
export type ManifestFile = {
  path: string;
  size?: number;
  handling: string;
  ops: string[];
  artifacts: string[];
  records: number;
  discarded: { anchor: string; reason: string; decision_ref?: DecisionRef }[];
  uncovered: { anchor: string; reason: string | null }[];
  uncovered_total: number;
  duration?: number;
  note: string;
};

/** records.jsonl 的一行（只取报告用到的字段） */
export type LineageRecord = {
  row: number;
  data: string;
  category: string;
  links?: { category: string; tags: string[] };
  sources?: RecordSource[];
};

/* ---------- 组装输入：load.ts 从 DB 与 OSS 读出，assemble.ts 纯函数处理 ---------- */

export type RawOperation = {
  id: string;
  approvalId: string;
  proposalId: string;
  recordsPath: string;
  recordsHash: string;
  committedAt: string;
  approvedBy: string;
  result: unknown;
  /** ingestion_records：本任务首次创建的语料 */
  created: { corpusId: string; row: number }[];
  /** OSS 中的 records 与来源追溯文件；旧批次或读取失败时为 null */
  records: LineageRecord[] | null;
  changes: LineageChange[] | null;
  manifest: ManifestFile[] | null;
  /** 来自原始文件、却没有可对照原值的部分（build_records 的 unchecked_total）；旧批次没有 */
  unchecked?: number;
};

export type RawApproval = {
  id: string;
  proposalId: string;
  kind: string | null;
  summary: string | null;
  input: Record<string, unknown>;
  status: string;
  expected: unknown;
  result: unknown;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
};

export type RawQuestionGroup = {
  id: string;
  toolCallId: string;
  status: string;
  questions: { id?: string; header: string; question: string; options: { label: string }[]; multiSelect?: boolean }[];
  answers: { question_id: string; selected: string[]; other?: string }[] | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type RawReportInput = {
  task: {
    id: string;
    taskNo: string;
    title: string;
    description: string;
    status: string;
    targetDatasetName: string;
    targetIngestionType: string;
    targetContentAttribute: string | null;
    modalities: string[];
    assignee: string;
    creator: string;
    createdAt: string;
    completedAt: string | null;
    cancelledAt: string | null;
  };
  files: { path: string; name: string; size: number; status: string }[];
  approvals: RawApproval[];
  operations: RawOperation[];
  questions: RawQuestionGroup[];
  checkpoints: { at: string; summary: string }[];
};

/* ---------- 报告 ---------- */

export type ReportKind = "final" | "draft";

export type ReportRecord = {
  /** 报告内编号 r-<n> */
  id: string;
  operationId: string;
  row: number;
  status: "inserted" | "skipped" | "unknown";
  corpusId: string | null;
  existingId: string | null;
  data: string;
  category: string | null;
  tags: string[];
  sources: RecordSource[];
};

export type ReportChange = Omit<LineageChange, "change_id"> & {
  /** 报告内编号：单次入库沿用 c-0012，多次入库为 c2-0012 */
  id: string;
  operationId: string;
  /** 进入「AI 存疑、人工确认或修正」一节 */
  attention: boolean;
  /** decision_ref 对应的报告内决策编号 */
  decisionId: string | null;
};

export type ReportDecision = {
  /** q-<n>：按提问顺序，一组里多题时为 q-<n>.<k> */
  id: string;
  groupId: string;
  header: string;
  question: string;
  options: string[];
  selected: string[];
  other: string | null;
  status: string;
  askedAt: string;
  answeredAt: string | null;
  /** 引用这次决策的变动与丢弃 */
  affects: string[];
};

export type ReportIssue = {
  /** i-<n> */
  id: string;
  kind:
    | "unexplained_change"
    | "flagged_unresolved"
    | "uncovered_input"
    | "unresolved_source"
    | "no_lineage"
    | "unprocessed_file"
    | "failed_proposal"
    | "unknown_records"
    | "unchecked_changes";
  detail: string;
  refs: string[];
};

export type ReportInputFile = ManifestFile & {
  /** 报告内编号 f-<n> */
  id: string;
  name: string;
  uploadStatus: string;
  /** 只在上传记录里、来源追溯文件没提到 */
  untracked: boolean;
};

export type ReportOperation = {
  /** p-<n> */
  id: string;
  approvalId: string;
  proposalId: string;
  kind: string | null;
  summary: string | null;
  status: string;
  expected: unknown;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
};

export type ReportSummary = {
  inputFiles: number;
  inserted: number;
  skipped: number;
  unknown: number;
  publishedMedia: number;
  reusedMedia: number;
  changes: number;
  changesByKind: Record<string, number>;
  changesByOrigin: Record<string, number>;
  attention: number;
  unexplained: number;
  discarded: number;
  decisions: number;
  proposals: number;
  deniedProposals: number;
  failedProposals: number;
  openIssues: number;
  byCategory: Record<string, number>;
  byTag: Record<string, number>;
};

export type ReportV1 = {
  schemaVersion: typeof REPORT_SCHEMA_VERSION;
  meta: {
    kind: ReportKind;
    version: number;
    generatedAt: string;
    task: RawReportInput["task"];
    /** 所有 insert_records 都带来源追溯文件 */
    lineage: "full" | "partial" | "none";
    sourceFiles: { operationId: string; recordsPath: string; recordsHash: string }[];
  };
  summary: ReportSummary;
  inputs: ReportInputFile[];
  organization: {
    dataset: {
      name: string;
      ingestionType: string;
      contentAttribute: string | null;
      registered: { name?: string; nickname?: string; description?: string } | null;
    };
    newCategories: { slug: string; name: string; parent: string | null; approvalId: string }[];
    newTags: { slug: string; name: string; facet?: string; gloss?: string; approvalId: string }[];
  };
  operations: ReportOperation[];
  records: ReportRecord[];
  changes: ReportChange[];
  decisions: ReportDecision[];
  openIssues: ReportIssue[];
  checkpoints: { at: string; summary: string }[];
};
