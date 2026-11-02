import assert from "node:assert/strict";
import test from "node:test";
import { buildEntryIdentity, type CorpusSearchRow } from "@/lib/search/entry-identity";
import { toPublicEntry, toPublicSearch } from "./web-content";
import { parseWebSearch } from "./web-contracts";
const row = (extra: Partial<CorpusSearchRow> = {}) => ({
  id: BigInt(162), unique_id: "9fb359b2-f561-4264-8e5e-ec899fb0cab1", data: "帆船（哥德堡一号）",
  note: { context: { 描述: "文化资料", 粤语: "https://example.com/yue.m4a", voxel: "https://example.com/model", secret: "NEVER_EXPOSE" }, contributor: "NEVER_EXPOSE" },
  structured_note: null, category: "culture", category_display_name: "文化资料",
  content_attribute: "cultural_knowledge", media_types: ["text", "audio", "model3d"],
  created_at: new Date("2026-01-01"), updated_at: new Date("2026-01-02"), ...extra,
} as CorpusSearchRow);
test("public Web DTO retains cultural, unclassified and missing definitions but no raw/permissions", () => {
  for (const content_attribute of ["cultural_knowledge", "unclassified", "oral"] as const) {
    const identity = buildEntryIdentity(row({ content_attribute }), { contributorIds: ["NEVER_EXPOSE"] });
    const result = toPublicEntry(identity);
    assert.equal(result.entryId, identity.entryId); assert.equal(result.entryName, identity.entryName);
    assert.equal(result.meaning, null); assert.equal(result.contentAttribute, content_attribute);
    assert.equal(result.content.description, "文化资料");
    assert.equal(result.assets.audioUrl, identity.assets.audioUrl); assert.equal(result.assets.model3dUrl, identity.assets.model3dUrl);
    assert.ok(!JSON.stringify(result).includes("NEVER_EXPOSE"));
    for (const field of ["raw", "editableLevel", "status"]) assert.ok(!(field in result));
  }
});
test("song, video, lyrics and structured content preserve grouping and use explicit safe fields", () => {
  const identity = buildEntryIdentity(row({ data: "落花流水", content_attribute: "oral", note: { context: {
    song_name: "落花流水", introduction: "歌曲介绍", album: "测试专辑", author: "演唱者", lyric: [{ data: "测试歌词", sec: 4, pron: "ce3 si3" }],
    video: "https://example.com/video.mp4", subtitle: "字幕内容", audio: "javascript:bad", internal: "NEVER_EXPOSE",
  } }, structured_note: { data: [{ jyutping: "ce3 si3", internal: "NEVER_EXPOSE", blocks: [
    { type: "sentence", content: "测试表达" }, { type: "definition", content: "测试释义" },
    { type: "example", content: [{ text: "测试例句", translation: "例句释义", audioUrl: "https://example.com/example.wav", secret: "NEVER_EXPOSE" }] },
    { type: "video", url: "javascript:bad" }, { type: "internal", content: "NEVER_EXPOSE" },
  ] }] } }));
  const result = toPublicEntry(identity);
  assert.equal(result.meaning, identity.meaning); assert.equal(result.content.introduction, "歌曲介绍");
  assert.equal(result.content.song?.name, "落花流水");
  assert.deepEqual(result.content.lyrics, [{ text: "测试歌词", jyutping: "ce3 si3", durationSeconds: 4 }]);
  assert.equal(result.assets.videoTranscript, "字幕内容"); assert.equal(result.assets.audioUrl, null);
  assert.equal(result.content.sections[0].blocks.length, 3); assert.ok(!JSON.stringify(result).includes("NEVER_EXPOSE"));
});
test("Web sections, ordering, cursors and partial failure status survive normalization", () => {
  const entry = buildEntryIdentity(row());
  const result = toPublicSearch({ query: "哥德堡", primary: entry, similar: [entry], recommended: [entry], sectionStatus: { primary: "success", semantic: "fallback" }, cursors: { similarNext: "3", recommendedNext: "4" } }, "test");
  assert.equal(result.schemaVersion, 2); assert.equal(result.primary?.entryId, entry.entryId);
  assert.equal(result.similar[0].entryId, entry.entryId); assert.equal(result.recommended[0].entryId, entry.entryId);
  assert.deepEqual(result.cursors, { similarNext: "3", recommendedNext: "4" }); assert.equal(result.sectionStatus?.semantic, "fallback");
});
test("v2 supports Web paging but rejects old or malformed query contracts", () => {
  assert.equal(parseWebSearch(new URLSearchParams("q=%20哥德堡%20&section=semantic&primaryCorpusId=162&similarCursor=3&recommendedCursor=4")).q, "哥德堡");
  for (const q of ["q=", "q=a&q=b", "q=a&limit=20", "q=a&cursor=old", "q=a&similarCursor=-1", "q=a&requestId=bad", "q=a&contentAttribute=private", "q=a&section=no", "q=a&primaryCorpusId=9999999999999999"]) {
    assert.throws(() => parseWebSearch(new URLSearchParams(q)), (e: any) => e.status === 400 && e.code === "INVALID_SEARCH_REQUEST");
  }
});
test("v2 route rejects invalid parameters before any database request", async () => {
  const { NextRequest } = await import("next/server");
  const { GET } = await import("../../app/api/miniprogram/search/v2/entries/route");
  const response = await GET(new NextRequest("https://example.com/api/miniprogram/search/v2/entries?q=a&limit=20"));
  assert.equal(response.status, 400); assert.equal((await response.json()).error.code, "INVALID_SEARCH_REQUEST");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("v2 audio events locate real assets/blocks/examples without inventing legacy sense indexes", async () => {
  const { CLIENT_EVENT_SCHEMAS } = await import("@/lib/analytics/events");
  const base = { schemaVersion: 2, entryId: "9fb359b2-f561-4264-8e5e-ec899fb0cab1", audioId: "/yue.m4a", playSessionId: "550e8400-e29b-41d4-a716-446655440000", surface: "entry_detail" };
  for (const target of [{ target: "asset" }, { target: "block", sectionIndex: 0, blockIndex: 1 }, { target: "example", sectionIndex: 0, blockIndex: 2, exampleIndex: 4 }]) {
    assert.equal(CLIENT_EVENT_SCHEMAS.audio_play.safeParse({ ...base, ...target }).success, true);
    assert.equal(CLIENT_EVENT_SCHEMAS.audio_error.safeParse({ ...base, ...target, loadAttemptId: base.playSessionId, errorType: "network" }).success, true);
  }
  for (const target of [{ target: "asset", sectionIndex: 0 }, { target: "block" }, { target: "example", sectionIndex: 0, blockIndex: 1 }, { target: "expression", senseIndex: 0 }])
    assert.equal(CLIENT_EVENT_SCHEMAS.audio_play.safeParse({ ...base, ...target }).success, false);
  assert.equal(CLIENT_EVENT_SCHEMAS.audio_play.safeParse({ ...base, schemaVersion: undefined, target: "expression", senseIndex: 0 }).success, true);
});
