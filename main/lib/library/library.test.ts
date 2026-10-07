import assert from "node:assert/strict";
import test from "node:test";
import {
  availableActions,
  formatSerial,
  leadTransition,
  transition,
} from "./application-workflow";
import { contributionApplicationSchema } from "./options";
import { filterAndSort, parsePublicDatasetQuery } from "./public-datasets";
import { loadLibraryOpsAccess } from "./ops-access";
import { AccessError } from "../services/submission-access";

test("application workflow follows the PRD state machine", () => {
  assert.deepEqual(transition("assign", "PENDING_INITIAL_REVIEW", false), {
    ok: true,
    to: "IN_REVIEW",
  });
  assert.equal(transition("accept", "PENDING_INITIAL_REVIEW", false).ok, false);
  assert.equal(transition("request-info", "IN_REVIEW", false).ok, true);
  assert.equal(transition("info-received", "PENDING_APPLICANT_INFO", false).ok, true);
  assert.equal(transition("review-complete", "RIGHTS_PRIVACY_REVIEW", false).ok, true);
  // Contact logs keep the current status.
  assert.deepEqual(transition("contact-logs", "PENDING_APPLICANT_INFO", false), {
    ok: true,
    to: "PENDING_APPLICANT_INFO",
  });
  // Final states cannot be reviewed again; only admins may reopen a rejection.
  assert.deepEqual(availableActions("ACCEPTED", true), []);
  assert.deepEqual(availableActions("REJECTED", false), []);
  assert.deepEqual(availableActions("REJECTED", true), ["reopen"]);
  assert.equal(transition("reject", "ACCEPTED", true).ok, false);
});

test("ingestion lead transitions require the assignee", () => {
  const owner = { isAssignee: true, isAdmin: false };
  const other = { isAssignee: false, isAdmin: false };
  assert.deepEqual(leadTransition("take", "PENDING_OWNER_ACCEPTANCE", owner), {
    ok: true,
    to: "IN_PROGRESS",
  });
  assert.equal(leadTransition("take", "PENDING_OWNER_ACCEPTANCE", other).ok, false);
  assert.equal(leadTransition("take", "IN_PROGRESS", owner).ok, false);
  assert.equal(leadTransition("close", "CLOSED", owner).ok, false);
  assert.equal(leadTransition("reassign", "IN_PROGRESS", owner).ok, false);
  assert.equal(
    leadTransition("reassign", "IN_PROGRESS", { isAssignee: false, isAdmin: true }).ok,
    true,
  );
});

test("serial numbers use the Shanghai calendar day", () => {
  assert.equal(
    formatSerial("CA", new Date("2026-09-12T17:30:00Z"), 8),
    "CA-20260913-008",
  );
  assert.equal(formatSerial("IL", new Date("2026-09-13T01:00:00Z"), 12), "IL-20260913-012");
});

const validApplication = {
  contributionKind: "dataset",
  contributorType: "individual",
  contactName: "林芷晴",
  contactEmail: "lin@example.org",
  organizationName: "个人贡献者",
  datasetName: "岭南街坊口述史音频语料",
  shortDescription: "社区口述历史访谈",
  modalities: ["audio"],
  useCase: "asr_tts",
  scaleDescription: "约 620 小时",
  sourceCollectionMethod: "社区访谈采集",
  rightsStatus: "written_authorization",
  rightsHolder: "岭南口述历史计划",
  submitterAuthority: "authorized_representative",
  intendedAccessMode: "after_review",
  licenseStatus: "custom_agreement",
  privacyStatus: "deidentified",
  declarations: { accurate: true, authorized: true, noAutoPublish: true },
};

test("contribution schema requires all three declarations and no file fields", () => {
  assert.equal(contributionApplicationSchema.safeParse(validApplication).success, true);
  assert.equal(
    contributionApplicationSchema.safeParse({
      ...validApplication,
      declarations: { accurate: true, authorized: true, noAutoPublish: false },
    }).success,
    false,
  );
  assert.equal(
    contributionApplicationSchema.safeParse({ ...validApplication, modalities: [] }).success,
    false,
  );
  const parsed = contributionApplicationSchema.parse({
    ...validApplication,
    fileUrl: "https://oss.example.com/raw.zip",
  });
  assert.equal("fileUrl" in parsed, false);
});

function dataset(slug: string, extra: Record<string, unknown> = {}) {
  return {
    slug,
    zhName: slug,
    enName: null,
    description: null,
    coverImageUrl: null,
    tags: [],
    modalities: [],
    useCases: [],
    accessMode: "metadata_only",
    scaleSummary: null,
    languageScope: null,
    sourceUrl: null,
    statusFlags: [],
    usageNotes: null,
    updatedAt: "2026-09-01T00:00:00.000Z",
    _pinned: false,
    _sorting: 0,
    ...extra,
  } as Parameters<typeof filterAndSort>[0][number];
}

test("public filters are OR within a group and AND across groups", () => {
  const items = [
    dataset("a", { modalities: ["text"], useCases: ["training"] }),
    dataset("b", { modalities: ["audio"], useCases: ["training"] }),
    dataset("c", { modalities: ["audio"], useCases: ["safety_eval"] }),
  ];
  const slugs = (q: Parameters<typeof filterAndSort>[1]) =>
    filterAndSort(items, q).map((d) => d.slug).sort();
  assert.deepEqual(slugs({ modalities: ["text", "audio"] }), ["a", "b", "c"]);
  assert.deepEqual(slugs({ modalities: ["audio"], useCases: ["training"] }), ["b"]);
});

test("search ranks name matches first and requires every term", () => {
  const items = [
    dataset("desc", { description: "粤语 安全 评测数据" }),
    dataset("name", { zhName: "粤语安全评测语料集" }),
    dataset("tag", { tags: ["安全"], description: "粤语" }),
  ];
  assert.deepEqual(
    filterAndSort(items, { q: "粤语 安全", sort: "relevance" }).map((d) => d.slug),
    ["name", "tag", "desc"],
  );
  assert.deepEqual(filterAndSort(items, { q: "ASR" }), []);
});

test("query parsing drops unknown values and never accepts download modes", () => {
  const q = parsePublicDatasetQuery(
    new URLSearchParams("access_modes=public_download,external&sort=largest&page_size=999"),
  );
  assert.deepEqual(q.accessModes, ["external"]);
  assert.equal(q.sort, "relevance");
  assert.equal(q.pageSize, 100);
});

function fakeDb(user: unknown) {
  return { user: { findUnique: async () => user } } as never;
}

test("library ops access needs an active role with a global capability", async () => {
  const role = { active: true, role_code: "ACTIVITY_REVIEWER", global_actions: [] as string[] };
  const user = { status: "ACTIVE", isSystemAdmin: false, isSuperAdmin: false, collectionOperatorRole: role };
  await assert.rejects(loadLibraryOpsAccess("u", fakeDb(user)), AccessError);
  role.global_actions = ["contribution_review", "unknown"];
  assert.deepEqual((await loadLibraryOpsAccess("u", fakeDb(user))).actions, [
    "contribution_review",
  ]);
  role.active = false;
  await assert.rejects(loadLibraryOpsAccess("u", fakeDb(user)), AccessError);
  const admin = await loadLibraryOpsAccess(
    "a",
    fakeDb({ ...user, isSystemAdmin: true, collectionOperatorRole: null }),
  );
  assert.equal(admin.isAdmin, true);
});
