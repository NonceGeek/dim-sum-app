import assert from "node:assert/strict";
import { test } from "node:test";
import { jwtVerify } from "jose";
import { formatSerial } from "@/lib/library/application-workflow";
import { signSessionToken } from "./agent";
import { displayStatus } from "./display-status";
import { BATCH_ID_RE, canUploadFiles, inputPath, newBatchId, workspacePrefix } from "./tasks";

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

test("batch ids match the agent's format and own a workspace prefix", () => {
  const id = newBatchId(new Date("2026-10-19T08:01:02Z"));
  assert.match(id, BATCH_ID_RE);
  assert.ok(id.startsWith("20261019-080102-"));
  assert.equal(workspacePrefix(id), `batches/${id}/`);
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
