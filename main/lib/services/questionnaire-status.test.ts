import assert from "node:assert/strict";
import test from "node:test";
import {
  getQuestionnaireEntryNavigation,
  resolveQuestionnaireSubmissionJourney,
} from "./questionnaire-journey";
import { buildQuestionnaireStatus } from "./questionnaire-status";

test("builds questionnaire status from the immutable profile and phone", () => {
  const completedAt = new Date("2026-08-20T08:00:00.000Z");

  assert.deepEqual(
    buildQuestionnaireStatus({
      phoneNumber: "13800138000",
      questionnaireProfile: { completed_at: completedAt },
    }),
    {
      completed: true,
      phoneVerified: true,
      completedAt: "2026-08-20T08:00:00.000Z",
    },
  );
});

test("keeps questionnaire and phone readiness independent", () => {
  assert.deepEqual(
    buildQuestionnaireStatus({
      phoneNumber: null,
      questionnaireProfile: { completed_at: new Date("2026-08-20T08:00:00.000Z") },
    }),
    {
      completed: true,
      phoneVerified: false,
      completedAt: "2026-08-20T08:00:00.000Z",
    },
  );
});

test("new reused journeys can open the submission page directly", () => {
  assert.deepEqual(
    getQuestionnaireEntryNavigation("reused", "entered_submission"),
    {
      canOpenSubmission: true,
      nextAction: "open_submission_page",
    },
  );
});

test("legacy reused journeys retain the enter-submission fallback", () => {
  assert.deepEqual(getQuestionnaireEntryNavigation("reused", "completed"), {
    canOpenSubmission: false,
    nextAction: "enter_submission",
  });
});

test("submission reuses the latest analytics journey when the client omits its id", async () => {
  const journey = {
    id: "9f2ca850-1b91-4c96-8124-bc7f4357e381",
    expires_at: new Date(Date.now() + 60_000),
  };
  let created = false;
  const tx = {
    user: {
      findUnique: async () => ({
        phoneNumber: "13800138000",
        questionnaireProfile: { id: BigInt(1) },
      }),
    },
    corpus_collection_questionnaire_journeys: {
      findFirst: async () => journey,
      create: async () => {
        created = true;
        return journey;
      },
    },
  } as unknown as Parameters<typeof resolveQuestionnaireSubmissionJourney>[0];

  const result = await resolveQuestionnaireSubmissionJourney(
    tx,
    "user-1",
    BigInt(123),
  );

  assert.equal(result, journey);
  assert.equal(created, false);
});

test("submission creates a fallback reused journey when analytics preparation failed", async () => {
  let createData: Record<string, unknown> | undefined;
  const createdJourney = {
    id: "9f2ca850-1b91-4c96-8124-bc7f4357e381",
    expires_at: new Date(Date.now() + 60_000),
  };
  const tx = {
    user: {
      findUnique: async () => ({
        phoneNumber: "13800138000",
        questionnaireProfile: { id: BigInt(1) },
      }),
    },
    corpus_collection_questionnaire_journeys: {
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createData = data;
        return createdJourney;
      },
    },
  } as unknown as Parameters<typeof resolveQuestionnaireSubmissionJourney>[0];

  const result = await resolveQuestionnaireSubmissionJourney(
    tx,
    "user-1",
    BigInt(123),
  );

  assert.equal(result, createdJourney);
  assert.equal(createData?.flow_type, "reused");
  assert.equal(createData?.status, "entered_submission");
});

test("submission without a journey still rejects an incomplete questionnaire profile", async () => {
  const tx = {
    user: {
      findUnique: async () => ({
        phoneNumber: "13800138000",
        questionnaireProfile: null,
      }),
    },
  } as unknown as Parameters<typeof resolveQuestionnaireSubmissionJourney>[0];

  await assert.rejects(
    resolveQuestionnaireSubmissionJourney(tx, "user-1", BigInt(123)),
    (error: unknown) =>
      error instanceof Error && error.message === "请先完成参赛前登记",
  );
});
