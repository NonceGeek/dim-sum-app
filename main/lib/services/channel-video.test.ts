import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { ChannelVideoError, parseChannelVideo } from "../channel-video";
import {
  createCorpusSubmission, updateCorpusSubmission, validateSubmissionMedia,
  serializeSubmission, serializePublicSubmission, serializeHomeSubmission, serializeHomeFeedSubmission,
} from "./corpus-collection";

const video = { finderUserName: "sphExample", feedId: "18446744073709551615" };
const body = { activityId: "10", submissionType: "video", title: "作品", intro: "说明", tags: ["故事"], media: [], channelVideo: video };
function fixture() {
  const state = { writes: [] as any[], deleted: 0, existing: {
    id: BigInt(1), user_id: "owner", activity_id: BigInt(10), activity: { id: BigInt(10), ends_at: new Date(Date.now() + 86400000) },
    created_at: new Date(), media: [], channel_video: video,
  } as any };
  const tx = {
    $queryRaw: async () => [],
    corpus_collection_activities: { findUnique: async () => ({ questionnaire_gate_enabled: false, status: "published", starts_at: new Date(Date.now() - 86400000), ends_at: new Date(Date.now() + 86400000) }) },
    corpus_collection_submissions: {
      findFirst: async ({ where }: any) => where.user_id === state.existing.user_id ? state.existing : null,
      create: async ({ data }: any) => { state.writes.push(data); return { ...state.existing, ...data }; },
      update: async ({ data }: any) => { state.writes.push(data); return { ...state.existing, ...data }; },
    },
    corpus_collection_submission_media: { deleteMany: async () => { state.deleted++; } },
  };
  return { state, db: { ...tx, $transaction: async (fn: any) => fn(tx) } as any };
}

test("IDs stay lossless strings and whitespace is normalized", () => {
  assert.deepEqual(parseChannelVideo({ finderUserName: " sphExample ", feedId: ` ${video.feedId} ` }), video);
  for (const input of [{}, [], "url", { ...video, feedId: 123 }, { ...video, feedId: "https://example.com" }, { ...video, finderUserName: "a b" }, { ...video, verified: true }, { ...video, feedId: "a".repeat(1025) }]) {
    assert.throws(() => parseChannelVideo(input), ChannelVideoError);
  }
});

test("Channels-only submissions and mixed media pass; legacy requirements remain", () => {
  assert.equal(validateSubmissionMedia([], null, video), true);
  assert.equal(validateSubmissionMedia([{ type: "image", url: "https://example.com/a.jpg" }], null, video), true);
  assert.equal(validateSubmissionMedia([], null), false);
  assert.equal(validateSubmissionMedia([{ type: "video", url: "v", durationSec: 31 }], null, video), false);
  assert.equal(validateSubmissionMedia([{ type: "image", url: "" }], null, video), false);
});

test("creation persists Channels IDs separately and enters private human review", async () => {
  const { state, db } = fixture();
  await createCorpusSubmission("owner", body, db);
  assert.deepEqual(state.writes[0].channel_video, video);
  assert.deepEqual(state.writes[0].media.create, []);
  assert.equal(state.writes[0].review_status, "pending_review");
  assert.equal(state.writes[0].visibility, "private");
});

test("invalid IDs fail before database mutation", async () => {
  const { state, db } = fixture();
  await assert.rejects(createCorpusSubmission("owner", { ...body, channelVideo: { finderUserName: "sph" } }, db), ChannelVideoError);
  assert.equal(state.writes.length, 0);
});

test("editing preserves omitted reference, replaces explicit IDs and clears stale review", async () => {
  for (const channelVideo of [undefined, { ...video, feedId: "new-id" }]) {
    const { state, db } = fixture();
    await updateCorpusSubmission("owner", BigInt(1), { ...body, channelVideo }, db);
    assert.deepEqual(state.writes[0].channel_video, channelVideo ?? video);
    assert.equal(state.writes[0].ai_review_result, Prisma.DbNull);
    assert.equal(state.writes[0].review_status, "pending_review");
    assert.equal(state.writes[0].visibility, "private");
  }
});

test("explicit removal requires another medium and cannot silently remove all content", async () => {
  const { state, db } = fixture();
  await assert.rejects(updateCorpusSubmission("owner", BigInt(1), { ...body, channelVideo: null }, db), /Invalid media requirements/);
  assert.equal(state.deleted, 0);
  await updateCorpusSubmission("owner", BigInt(1), { ...body, channelVideo: null, media: [{ type: "video", url: "https://example.com/video.mp4" }] }, db);
  assert.equal(state.writes[0].channel_video, Prisma.DbNull);
});

test("another author and locked submissions cannot change the reference", async () => {
  const { state, db } = fixture();
  await assert.rejects(updateCorpusSubmission("other", BigInt(1), body, db), /Submission not found/);
  state.existing.is_locked = true;
  await assert.rejects(updateCorpusSubmission("owner", BigInt(1), body, db), /submission_edit_not_allowed/);
  assert.equal(state.writes.length, 0);
  assert.equal(state.deleted, 0);
});

test("all public and admin serializers return the reference, legacy rows return null", () => {
  const { state } = fixture();
  for (const serialize of [serializeSubmission, serializePublicSubmission, serializeHomeSubmission, serializeHomeFeedSubmission]) {
    assert.deepEqual(serialize(state.existing).channelVideo, video);
    assert.equal(serialize({ ...state.existing, channel_video: null }).channelVideo, null);
  }
});


test("export feed IDs remain intact across validation, storage and serialization", async () => {
  const fullVideo = { ...video, feedId: "export/UzFfAgtgekIEAQAAAAAASPYFWC0gZQAAAAstQy6ubaLX4KHWvLEZgBPEm6I0eRMRIKWLzNPgMJpyElocHON4K1eMQqcia73t" };
  assert.deepEqual(parseChannelVideo({ ...fullVideo, feedId: ` ${fullVideo.feedId} ` }), fullVideo);
  for (const feedId of ["export/", "export/export/abc", "other/abc", "https://example.com/export/abc"]) {
    assert.throws(() => parseChannelVideo({ ...video, feedId }), ChannelVideoError);
  }
  const { state, db } = fixture();
  await createCorpusSubmission("owner", { ...body, channelVideo: fullVideo }, db);
  assert.deepEqual(state.writes[0].channel_video, fullVideo);
  assert.deepEqual(serializeSubmission({ ...state.existing, channel_video: fullVideo }).channelVideo, fullVideo);
});
