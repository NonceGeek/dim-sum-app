import assert from "node:assert/strict";
import { test } from "node:test";
import { jwtVerify } from "jose";
import type { TaskApproval } from "@/components/ingestion/types";
import { formatSerial } from "@/lib/library/application-workflow";
import { signSessionToken } from "./agent";
import { displayStatus } from "./display-status";
import { canUploadFiles, inputPath, workspacePrefix } from "./tasks";
import { buildTimeline } from "./timeline";
import {
  defaultTaskTitle,
  isDraft,
  isMediaPath,
  MEDIA_DIR,
  normalizeModalities,
  shanghaiDayStart,
} from "./task-options";

test("display status combines the task status with the agent session status", () => {
  assert.equal(displayStatus("PENDING", null), "PENDING");
  assert.equal(displayStatus("IN_PROGRESS", null), "PENDING");
  assert.equal(displayStatus("IN_PROGRESS", "running"), "PROCESSING");
  assert.equal(displayStatus("IN_PROGRESS", "ready"), "PROCESSING");
  assert.equal(displayStatus("IN_PROGRESS", "waiting_approval"), "WAITING_APPROVAL");
  assert.equal(displayStatus("IN_PROGRESS", "waiting_input"), "WAITING_INPUT");
  assert.equal(displayStatus("IN_PROGRESS", "failed"), "ERROR");
  assert.equal(displayStatus("IN_PROGRESS", "interrupted"), "ERROR");
  assert.equal(displayStatus("COMPLETED", "completed"), "COMPLETED");
  assert.equal(displayStatus("CANCELLED", "running"), "CANCELLED");
});

test("uploads are allowed before the session starts or while it can continue", () => {
  assert.equal(canUploadFiles("PENDING", null), true);
  assert.equal(canUploadFiles("IN_PROGRESS", "ready"), true);
  assert.equal(canUploadFiles("IN_PROGRESS", "failed"), true);
  assert.equal(canUploadFiles("IN_PROGRESS", "running"), false);
  assert.equal(canUploadFiles("IN_PROGRESS", "waiting_approval"), false);
  assert.equal(canUploadFiles("CANCELLED", null), false);
});

test("input paths stay inside input/", () => {
  assert.equal(inputPath("a.csv"), "input/a.csv");
  assert.equal(inputPath("dir\\sub/b.wav"), "input/dir/sub/b.wav");
  assert.equal(inputPath("a//b"), "input/a/b");
  assert.equal(inputPath("./a"), "input/a");
  for (const bad of ["", "/etc/passwd", "../x", "a/../../x", "..", "a\0b"])
    assert.throws(() => inputPath(bad), bad);
});

test("task modalities keep a fixed order and always include text", () => {
  assert.deepEqual(normalizeModalities([]), ["text"]);
  assert.deepEqual(normalizeModalities(["image", "audio", "audio", "multimodal"]), ["text", "audio", "image"]);
});

test("drafts are pending tasks without a session; media live under input/media/", () => {
  assert.equal(isDraft("PENDING", false), true);
  assert.equal(isDraft("PENDING", true), false);
  assert.equal(isDraft("IN_PROGRESS", false), false);
  assert.equal(isMediaPath(inputPath(`${MEDIA_DIR}/a/b.wav`)), true);
  assert.equal(isMediaPath(inputPath("media.xlsx")), false);
});

test("default task titles use the dataset name and the Shanghai day", () => {
  assert.equal(defaultTaskTitle(" 日常口语词条集 ", new Date("2026-10-20T17:00:00Z")), "日常口语词条集 · 2026-10-21");
});

test("today starts at Shanghai midnight", () => {
  assert.equal(shanghaiDayStart(new Date("2026-10-20T17:00:00Z")).toISOString(), "2026-10-20T16:00:00.000Z");
  assert.equal(shanghaiDayStart(new Date("2026-10-20T15:59:59Z")).toISOString(), "2026-10-19T16:00:00.000Z");
});

test("workspace prefixes start with the task number and stay unique", () => {
  const prefix = workspacePrefix("IT-20261026-001");
  assert.match(prefix, /^batches\/IT-20261026-001-[a-z0-9]{6}\/$/);
  assert.notEqual(workspacePrefix("IT-20261026-001"), prefix);
});

test("task numbers use the Shanghai calendar day", () => {
  assert.equal(formatSerial("IT", new Date("2026-10-19T17:00:00Z"), 7), "IT-20261020-007");
});

test("session tokens carry the user and task for the agent", async () => {
  const secret = "s".repeat(32);
  const token = await signSessionToken({ userId: "u1", taskId: "42" }, 600, secret);
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
    algorithms: ["HS256"],
    audience: "corpus-ingest-agent",
  });
  assert.equal(payload.sub, "u1");
  assert.equal(payload.task_id, "42");
  assert.ok(payload.exp! - payload.iat! === 600);
  await assert.rejects(
    jwtVerify(token, new TextEncoder().encode("x".repeat(32)), { audience: "corpus-ingest-agent" }),
  );
});

/* ---------- 右栏时间线 ---------- */

const at = (minute: number) => new Date(Date.UTC(2026, 9, 22, 11, minute)).toISOString();
const baseTask = {
  createdAt: at(0),
  createdByName: "dev",
  status: "IN_PROGRESS" as const,
  closed: false,
  completedAt: null,
  cancelledAt: null,
  files: [
    { id: "f2", path: "input/b.wav", name: "b.wav", size: 1, status: "UPLOADED" as const, uploadedBy: "dev", createdAt: at(3) },
    { id: "f1", path: "input/a.tsv", name: "a.tsv", size: 1, status: "FAILED" as const, uploadedBy: "dev", createdAt: at(2) },
  ],
  events: [{ id: "e1", operationType: "session_started", operator: "dev", note: null, createdAt: at(5) }],
  approvals: [],
  questions: [],
  operations: [],
};
const question = (status: "pending" | "answered" | "cancelled", minute: number) => ({
  id: `q${minute}`,
  toolCallId: `call-${minute}`,
  turnId: null,
  headers: ["重复数据"],
  answers: status === "answered" ? ["仍新建"] : null,
  status,
  createdAt: at(minute),
  resolvedAt: null,
});
const kinds = (nodes: ReturnType<typeof buildTimeline>) => nodes.map((n) => `${n.kind}:${n.state}`);

test("timeline orders milestones by time and ends with the next step while open", () => {
  const nodes = buildTimeline({ ...baseTask, questions: [question("pending", 30)] }, { status: "waiting_input", last_error: null }, null);
  assert.deepEqual(kinds(nodes), ["created:done", "files:done", "session:done", "question:now", "next:todo"]);
  const files = nodes[1];
  assert.ok(files.kind === "files" && files.at === at(2) && files.count === 2 && files.failed === 1);
});

test("timeline shows the agent working or failing after the last milestone", () => {
  assert.deepEqual(kinds(buildTimeline(baseTask, { status: "running", last_error: null }, null)).slice(-2), ["working:now", "next:todo"]);
  const failed = buildTimeline(baseTask, { status: "failed", last_error: "boom" }, null);
  const error = failed.at(-2);
  assert.ok(error?.kind === "error" && error.message === "boom" && error.state === "now");
});

test("timeline marks a pending approval as now and a denied one as stopped", () => {
  const approval = (id: string, status: TaskApproval["status"], minute: number) => ({
    id, proposalId: id, summary: null, steps: [], expected: {}, status, decidedByName: null, decidedAt: null,
    decisionNote: null, settledAt: null, expiresAt: at(59), createdAt: at(minute), turnId: null, toolCallId: null,
  });
  // 审批接口按时间倒序返回
  const nodes = buildTimeline({ ...baseTask, approvals: [approval("b", "pending", 40), approval("a", "denied", 20)] }, null, null);
  assert.deepEqual(kinds(nodes).slice(3), ["approval:stopped", "approval:now", "next:todo"]);
});

test("cancelled tasks end on the cancel event with unanswered questions stopped", () => {
  const nodes = buildTimeline(
    {
      ...baseTask,
      status: "CANCELLED",
      closed: true,
      cancelledAt: at(50),
      events: [{ id: "e2", operationType: "cancelled", operator: "ops", note: null, createdAt: at(50) }, ...baseTask.events],
      questions: [question("cancelled", 30)],
    },
    { status: "cancelled", last_error: null },
    { version: 1, kind: "final", status: "ready", createdAt: at(51) },
  );
  assert.deepEqual(kinds(nodes), ["created:done", "files:done", "session:done", "question:stopped", "end:stopped", "report:done"]);
  const end = nodes[4];
  assert.ok(end.kind === "end" && end.by === "ops" && end.outcome === "cancelled");
});

test("completed tasks list every write and have no next step", () => {
  const write = (id: string, minute: number) => ({
    id, approvalId: id, approvedByName: "dev", approvedAt: at(minute - 1), committedAt: at(minute), recordCount: 10, turnId: null, toolCallId: null,
  });
  const nodes = buildTimeline(
    { ...baseTask, status: "COMPLETED", closed: true, completedAt: at(58), questions: [question("answered", 10)], operations: [write("w1", 30), write("w2", 45)] },
    { status: "completed", last_error: null },
    null,
  );
  assert.deepEqual(kinds(nodes).slice(3), ["question:done", "write:done", "write:done", "end:done"]);
});

test("tasks without files or a session still start with creation and files", () => {
  const nodes = buildTimeline({ ...baseTask, files: [], events: [] }, null, null);
  assert.deepEqual(kinds(nodes), ["created:done", "files:done", "next:todo"]);
  assert.ok(nodes[1].kind === "files" && nodes[1].at === at(0) && nodes[1].count === 0);
});
