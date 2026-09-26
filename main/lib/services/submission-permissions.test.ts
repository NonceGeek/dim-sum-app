import assert from "node:assert/strict";
import test from "node:test";
import {
  canAct,
  COLLECTION_ACTIONS,
  ROLE_PRESETS,
  validActions,
  CollectionAccess,
} from "../collection-permissions";
import {
  loadSubmissionAccess,
  AccessError,
  batchScope,
  submissionScope,
} from "./submission-access";
import { mutateSubmissions, submissionIdsSchema } from "./submission-mutations";

function fixture(actions: string[] = [...COLLECTION_ACTIONS]) {
  const state = {
    user: {
      status: "ACTIVE",
      isSystemAdmin: false,
      isSuperAdmin: false,
      collectionOperatorRole: { active: true, role_code: "ACTIVITY_OPERATOR" },
    },
    grants: [{ activity_id: BigInt(10), submission_actions: actions }],
    rows: [BigInt(10), BigInt(20), null].map((activity_id, i) => ({
      id: BigInt(i + 1),
      activity_id,
      user_id: "author",
      title: "作品",
      review_status: "pending_review",
      visibility: "private",
      is_featured: false,
      show_on_home: false,
      is_awarded: false,
      award_status: "none",
      review_reason: null,
      reviewed_by: null,
      reviewed_at: null,
    })),
    logs: [] as any[],
    messages: [] as any[],
    writes: 0,
    failLog: false,
    locks: [] as any[],
  };
  const tx = {
    $queryRaw: async (...args: any[]) => {
      state.locks.push(args);
      return [];
    },
    user: { findUnique: async () => state.user },
    corpus_collection_activity_permissions: {
      findMany: async () => state.grants,
    },
    corpus_collection_submissions: {
      findMany: async ({ where }: any) =>
        state.rows
          .filter((r) => where.id.in.includes(r.id))
          .map((r) => ({ ...r })),
      update: async ({ where, data }: any) => {
        const row = state.rows.find((r) => r.id === where.id)!;
        for (const [key, value] of Object.entries(data))
          if (value !== undefined && key !== "reviewer")
            (row as any)[key] = value;
        if (data.reviewer) row.reviewed_by = data.reviewer.connect.id;
        state.writes++;
        return { ...row };
      },
    },
    corpus_collection_messages: {
      create: async ({ data }: any) => {
        state.messages.push(data);
      },
    },
    corpus_collection_audit_logs: {
      create: async ({ data }: any) => {
        if (state.failLog) throw new Error("audit failure");
        state.logs.push(data);
      },
    },
  };
  const db = {
    $transaction: async (fn: any) => {
      const before = structuredClone({
        rows: state.rows,
        logs: state.logs,
        messages: state.messages,
        writes: state.writes,
      });
      try {
        return await fn(tx);
      } catch (e) {
        Object.assign(state, before);
        throw e;
      }
    },
  } as any;
  return { state, tx: tx as any, db };
}
const denied = (status: number) => (error: unknown) =>
  error instanceof AccessError && error.status === status;

test("role presets include view, while malformed and unknown capabilities fail closed", () => {
  for (const preset of Object.values(ROLE_PRESETS))
    assert.ok(preset.includes("view"));
  for (const value of [["approve"], ["view", "unknown"], {}, null])
    assert.deepEqual(validActions(value), []);
});
test("operator has only per-activity actions, never access to unassigned submissions", () => {
  const access: CollectionAccess = {
    userId: "u",
    role: "ACTIVITY_OPERATOR",
    isAdmin: false,
    grants: { "10": ["view", "award"], "20": ["view"] },
  };
  assert.equal(canAct(access, BigInt(10), "award"), true);
  assert.equal(canAct(access, BigInt(20), "award"), false);
  assert.equal(canAct(access, BigInt(30), "view"), false);
  assert.equal(canAct(access, null, "view"), false);
  assert.equal(
    canAct({ ...access, role: "unknown" }, BigInt(10), "award"),
    false,
  );
});
test("system administrators have all activity and unassigned permissions", async () => {
  const { state, tx } = fixture([]);
  state.user.isSystemAdmin = true;
  const access = await loadSubmissionAccess("u", tx);
  for (const action of COLLECTION_ACTIONS)
    for (const id of [BigInt(10), BigInt(20), null])
      assert.ok(canAct(access, id, action));
  assert.deepEqual(submissionScope(access), {});
});
test("disabled system administrators fail closed", async () => {
  const { state, tx } = fixture();
  state.user.isSystemAdmin = true;
  state.user.status = "DELETED";
  await assert.rejects(loadSubmissionAccess("u", tx), denied(403));
});
test("revoked and unrecognized roles reject despite saved grants", async () => {
  const { state, tx } = fixture();
  state.user.collectionOperatorRole.active = false;
  await assert.rejects(loadSubmissionAccess("u", tx), denied(403));
  state.user.collectionOperatorRole.active = true;
  state.user.collectionOperatorRole.role_code = "unknown";
  await assert.rejects(loadSubmissionAccess("u", tx), denied(403));
});
test("view scope contains only view grants, and legacy batch scope requires every member", async () => {
  const { state, tx } = fixture(["view"]);
  state.grants.push({ activity_id: BigInt(20), submission_actions: [] });
  const access = await loadSubmissionAccess("u", tx);
  assert.deepEqual(submissionScope(access), {
    activity_id: { in: [BigInt(10)] },
  });
  assert.deepEqual(batchScope(access), {
    items: {
      some: {},
      every: { submission: { activity_id: { in: [BigInt(10)] } } },
    },
  });
});
test("cross-activity mixed bulk request is rejected before any write or message", async () => {
  const { state, db } = fixture();
  await assert.rejects(
    mutateSubmissions("u", [BigInt(1), BigInt(2)], "approve", {}, db),
    denied(404),
  );
  assert.equal(state.writes, 0);
  assert.equal(state.messages.length, 0);
  assert.equal(state.logs.length, 0);
});
test("view-only user cannot approve an accessible submission", async () => {
  const { state, db } = fixture(["view"]);
  await assert.rejects(
    mutateSubmissions("u", [BigInt(1)], "approve", {}, db),
    denied(403),
  );
  assert.equal(state.writes, 0);
});
test("combined display fields require every capability and cannot overpost", async () => {
  const { state, db } = fixture(["view", "feature"]);
  await assert.rejects(
    mutateSubmissions(
      "u",
      [BigInt(1)],
      "display",
      { isFeatured: true, showOnHome: true },
      db,
    ),
    denied(403),
  );
  await assert.rejects(
    mutateSubmissions(
      "u",
      [BigInt(1)],
      "display",
      { isFeatured: true, visibility: "public" },
      db,
    ),
    denied(403),
  );
  await assert.rejects(
    mutateSubmissions(
      "u",
      [BigInt(1)],
      "display",
      { isFeatured: true, reviewed_by: "other" },
      db,
    ),
    denied(400),
  );
  assert.equal(state.writes, 0);
  await mutateSubmissions(
    "u",
    [BigInt(1)],
    "display",
    { isFeatured: true },
    db,
  );
  assert.equal(state.rows[0].is_featured, true);
  assert.equal(state.rows[0].visibility, "private");
});
test("valid bulk approval commits all messages and role/state audit snapshots", async () => {
  const { state, db } = fixture();
  state.grants.push({
    activity_id: BigInt(20),
    submission_actions: ["view", "approve"],
  });
  await mutateSubmissions("u", [BigInt(1), BigInt(2)], "approve", {}, db);
  assert.equal(state.writes, 2);
  assert.equal(state.messages.length, 2);
  assert.equal(state.logs.length, 2);
  assert.equal(state.logs[0].operator_role, "ACTIVITY_OPERATOR");
  assert.equal(state.logs[0].before_state.reviewStatus, "pending_review");
  assert.equal(state.logs[0].after_state.reviewStatus, "approved");
  assert.equal(state.rows[2].review_status, "pending_review");
  assert.ok(state.locks.length >= 3);
});
test("audit failure rolls back state changes and notification creation", async () => {
  const { state, db } = fixture();
  state.failLog = true;
  await assert.rejects(
    mutateSubmissions("u", [BigInt(1)], "approve", {}, db),
    /audit failure/,
  );
  assert.equal(state.rows[0].review_status, "pending_review");
  assert.equal(state.messages.length, 0);
  assert.equal(state.writes, 0);
});
test("operation rechecks role after locking, even if an earlier request check passed", async () => {
  const { state, tx, db } = fixture();
  await loadSubmissionAccess("u", tx);
  state.user.collectionOperatorRole.active = false;
  await assert.rejects(
    mutateSubmissions("u", [BigInt(1)], "approve", {}, db),
    denied(403),
  );
  assert.equal(state.writes, 0);
});
test("award is independently granted and repeat marking does not send duplicate notifications", async () => {
  const { state, db } = fixture(["view", "award"]);
  await mutateSubmissions("u", [BigInt(1)], "award", { isAwarded: true }, db);
  await mutateSubmissions("u", [BigInt(1)], "award", { isAwarded: true }, db);
  assert.equal(state.messages.length, 1);
  await mutateSubmissions("u", [BigInt(1)], "award", { isAwarded: false }, db);
  assert.equal(state.rows[0].award_status, "none");
  assert.equal(state.logs.length, 3);
});
test("reject requires a nonempty reason and bulk IDs must be unique and valid", async () => {
  const { db } = fixture();
  await assert.rejects(
    mutateSubmissions("u", [BigInt(1)], "reject", { reason: " " }, db),
    denied(400),
  );
  for (const ids of [
    [],
    ["1", "1"],
    ["1", "bad"],
    ["0"],
    Array.from({ length: 101 }, (_, i) => String(i + 1)),
  ])
    assert.equal(submissionIdsSchema.safeParse(ids).success, false);
});
