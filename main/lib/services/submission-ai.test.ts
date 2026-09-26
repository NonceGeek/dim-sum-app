import test from "node:test";
import assert from "node:assert/strict";
import { startSubmissionBatches } from "./submission-ai";
import { AccessError } from "./submission-access";
function fixture() {
  const rows = [10, 20].map((id, i) => ({
    id: BigInt(i + 1),
    activity_id: BigInt(id),
    review_status: "pending_review",
    title: "作品",
    intro: "介绍",
    media: [],
    channel_video: null as unknown,
  }));
  const state = {
    roleActive: true,
    grants: [
      { activity_id: BigInt(10), submission_actions: ["view", "ai_review"] },
    ],
    batches: [] as any[],
    calls: [] as any[],
    logs: [] as any[],
    transactionCommitted: false,
  };
  const tx = {
    $queryRaw: async () => [],
    user: {
      findUnique: async () => ({
        status: "ACTIVE",
        isSystemAdmin: false,
        isSuperAdmin: false,
        collectionOperatorRole: {
          role_code: "ACTIVITY_REVIEWER",
          active: state.roleActive,
        },
      }),
    },
    corpus_collection_activity_permissions: {
      findMany: async () => state.grants,
    },
    corpus_collection_submissions: {
      findMany: async ({ where }: any) =>
        rows.filter((r) => where.id.in.includes(r.id)),
      updateMany: async () => ({ count: 1 }),
    },
    corpus_collection_review_batches: {
      create: async ({ data }: any) => {
        const batch = { ...data, id: BigInt(state.batches.length + 1) };
        state.batches.push(batch);
        return batch;
      },
      updateMany: async ({ where, data }: any) => {
        const b = state.batches.find((b) => b.id === where.id);
        if (b.status === where.status) Object.assign(b, data);
        return { count: 1 };
      },
    },
    corpus_collection_audit_logs: {
      create: async ({ data }: any) => {
        state.logs.push(data);
      },
    },
  };
  const db = {
    ...tx,
    $transaction: async (fn: any) => {
      const result = await fn(tx);
      state.transactionCommitted = true;
      return result;
    },
  } as any;
  const send = async (payload: any) => {
    assert.equal(state.transactionCommitted, true);
    state.calls.push(payload);
    return {
      batchId: "agent",
      status: "queued",
      submissionCount: payload.submissions.length,
    };
  };
  return { state, rows, dependencies: { db, send } };
}
test("AI rejects a mixed unauthorized batch before creating jobs or calling provider", async () => {
  process.env.CORPUS_COLLECTION_WEBHOOK_TOKEN = "test-only";
  const { state, dependencies } = fixture();
  await assert.rejects(
    startSubmissionBatches(
      "u",
      [BigInt(1), BigInt(2)],
      {},
      "http://localhost",
      dependencies,
    ),
    (e: unknown) => e instanceof AccessError && e.status === 404,
  );
  assert.equal(state.batches.length, 0);
  assert.equal(state.calls.length, 0);
});
test("AI authorization is independent of view access", async () => {
  const { state, dependencies } = fixture();
  state.grants[0].submission_actions = ["view"];
  await assert.rejects(
    startSubmissionBatches(
      "u",
      [BigInt(1)],
      {},
      "http://localhost",
      dependencies,
    ),
    (e: unknown) => e instanceof AccessError && e.status === 403,
  );
  assert.equal(state.calls.length, 0);
});
test("AI splits activity groups, derives membership and saves tasks before external calls", async () => {
  const { state, dependencies } = fixture();
  state.grants.push({
    activity_id: BigInt(20),
    submission_actions: ["view", "ai_review"],
  });
  const results = await startSubmissionBatches(
    "u",
    [BigInt(1), BigInt(2)],
    {},
    "http://localhost",
    dependencies,
  );
  assert.equal(results.length, 2);
  assert.equal(state.calls.length, 2);
  assert.deepEqual(
    state.batches.map((b) => String(b.activity_id)),
    ["10", "20"],
  );
  assert.deepEqual(
    state.calls.map((c) =>
      c.submissions.map((s: any) => s.submissionExternalId),
    ),
    [["1"], ["2"]],
  );
});
test("AI records uncertain dispatch without automatically resubmitting or undoing accepted jobs", async () => {
  const { state, dependencies } = fixture();
  dependencies.send = async () => {
    throw new Error("timeout");
  };
  const result = await startSubmissionBatches(
    "u",
    [BigInt(1)],
    {},
    "http://localhost",
    dependencies,
  );
  assert.equal(result[0].status, "dispatch_unknown");
  assert.equal(state.batches[0].status, "dispatch_unknown");
  assert.ok(state.logs.some((log) => log.outcome === "unknown"));
});
test("AI does not replace completion from a callback that arrived before provider response", async () => {
  const { state, dependencies } = fixture();
  dependencies.send = async () => {
    state.batches[0].status = "completed";
    return { batchId: "agent", status: "queued", submissionCount: 1 };
  };
  await startSubmissionBatches(
    "u",
    [BigInt(1)],
    {},
    "http://localhost",
    dependencies,
  );
  assert.equal(state.batches[0].status, "completed");
});
test("AI cannot start without authenticated callback configuration", async () => {
  const old = process.env.CORPUS_COLLECTION_WEBHOOK_TOKEN;
  delete process.env.CORPUS_COLLECTION_WEBHOOK_TOKEN;
  const { state, dependencies } = fixture();
  try {
    await assert.rejects(
      startSubmissionBatches(
        "u",
        [BigInt(1)],
        {},
        "http://localhost",
        dependencies,
      ),
      (e: unknown) => e instanceof AccessError && e.status === 503,
    );
  } finally {
    process.env.CORPUS_COLLECTION_WEBHOOK_TOKEN = old;
  }
  assert.equal(state.calls.length, 0);
});

import { processReviewEvent } from "./submission-review-event";
function callbackFixture() {
  const state = {
    member: true,
    latest: true,
    status: "ai_reviewing",
    itemStatus: "queued",
    events: new Set<string>(),
    updates: 0,
    logs: [] as any[],
    result: null as any,
    channelVideo: null as unknown,
  };
  const tx = {
    $queryRaw: async () => [],
    corpus_collection_review_events: {
      findUnique: async ({ where }: any) =>
        state.events.has(where.event_id) ? {} : null,
      create: async ({ data }: any) => state.events.add(data.event_id),
    },
    corpus_collection_review_batches: {
      findFirst: async () => ({ id: BigInt(1), activity_id: BigInt(10) }),
      update: async () => ({}),
    },
    corpus_collection_review_batch_items: {
      findUnique: async () =>
        state.member ? { id: BigInt(1), status: state.itemStatus } : null,
      findFirst: async () => ({ id: BigInt(state.latest ? 1 : 2) }),
      update: async ({ data }: any) => {
        state.itemStatus = data.status;
        state.result = data.result;
      },
    },
    corpus_collection_submissions: {
      findUniqueOrThrow: async () => ({
        id: BigInt(1),
        activity_id: BigInt(10),
        review_status: state.status,
        channel_video: state.channelVideo,
      }),
      update: async ({ data }: any) => {
        state.updates++;
        state.status = data.review_status;
      },
    },
    corpus_collection_audit_logs: {
      create: async ({ data }: any) => {
        state.logs.push(data);
      },
    },
  };
  const db = { $transaction: async (fn: any) => fn(tx) } as any;
  const payload = {
    event: "submission.reviewed" as const,
    batchExternalId: "batch",
    submissionExternalId: "1",
    result: { verdict: "pass" },
  };
  return { state, db, payload };
}
test("callback rejects submission IDs outside the actual batch", async () => {
  const { state, db, payload } = callbackFixture();
  state.member = false;
  await assert.rejects(
    processReviewEvent(payload, "event", db),
    (e: unknown) => e instanceof AccessError && e.status === 404,
  );
  assert.equal(state.updates, 0);
  assert.equal(state.events.size, 0);
});
test("callback leaves reviewed submissions unchanged, and records ignored result", async () => {
  for (const status of ["approved", "rejected", "review_needed"]) {
    const { state, db, payload } = callbackFixture();
    state.status = status;
    await processReviewEvent(payload, "event", db);
    assert.equal(state.updates, 0);
    assert.equal(state.status, status);
    assert.equal(state.logs[0].outcome, "ignored");
  }
});
test("callback from an older batch cannot overwrite a newly queued review", async () => {
  const { state, db, payload } = callbackFixture();
  state.latest = false;
  await processReviewEvent(payload, "event", db);
  assert.equal(state.updates, 0);
  assert.equal(state.itemStatus, "superseded");
});
test("callback only requests human review and duplicate events have no effects", async () => {
  const { state, db, payload } = callbackFixture();
  await processReviewEvent(payload, "event", db);
  await processReviewEvent(payload, "event", db);
  assert.equal(state.status, "review_needed");
  assert.equal(state.updates, 1);
  assert.equal(state.logs.length, 1);
});


test("AI refuses the entire mixed Channels batch before writes or external calls", async () => {
  process.env.CORPUS_COLLECTION_WEBHOOK_TOKEN = "test-only";
  const { state, rows, dependencies } = fixture();
  state.grants.push({ activity_id: BigInt(20), submission_actions: ["view", "ai_review"] });
  rows[1].channel_video = { finderUserName: "sphExample", feedId: "123" };
  await assert.rejects(startSubmissionBatches("u", [BigInt(1), BigInt(2)], {}, "http://localhost", dependencies),
    (e: unknown) => e instanceof AccessError && e.status === 422);
  assert.equal(state.batches.length, 0);
  assert.equal(state.calls.length, 0);
  assert.equal(state.logs.length, 0);
});


test("late AI callback cannot review a Channels reference added after dispatch", async () => {
  const { state, db, payload } = callbackFixture();
  state.channelVideo = { finderUserName: "sphExample", feedId: "123" };
  await processReviewEvent(payload, "event", db);
  assert.equal(state.updates, 0);
  assert.equal(state.itemStatus, "superseded");
});
