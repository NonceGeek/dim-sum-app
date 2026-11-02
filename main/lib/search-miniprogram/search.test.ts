import assert from "node:assert/strict";
import test from "node:test";
import { formatEntry, httpsAudio, jyutping, type SearchRow } from "./content";
import {
  parseSearch,
  encodeCursor,
  decodeCursor,
  feedbackInput,
  sameFeedback,
} from "./contracts";
import { parseClientEvent, ingestBatchSchema } from "@/lib/analytics/events";
import { parseDays } from "./analytics";
const id = "550e8400-e29b-41d4-a716-446655440000";
const row: SearchRow = {
  id: BigInt(1),
  unique_id: id,
  expression: "唔该",
  meaning: "谢谢",
  note: { context: { 普通话: "https://example.com/mandarin.wav" } },
  structured_note: null,
  dataset_name: "qa",
  dataset_label: "QA",
};
test("only HTTPS audio is exposed, Mandarin fallback and invalid pronunciation are omitted", () => {
  assert.equal(formatEntry(row).senses[0].audio, null);
  assert.equal(httpsAudio("javascript:alert(1)"), null);
  assert.equal(httpsAudio("http://example.com/a.wav"), null);
  assert.equal(httpsAudio("https://name:pass@example.com/a.wav"), null);
  assert.equal(jyutping("wu2 gai1"), "wu2 gai1");
  assert.equal(jyutping("你好"), null);
});
test("structured senses keep their own examples, pronunciation and confirmed Cantonese audio", () => {
  const data = {
    data: [
      {
        jyutping: "m4 goi1",
        blocks: [
          { type: "sentence", content: "唔该" },
          { type: "definition", content: "谢谢" },
          { type: "audio", url: "https://example.com/yue.wav" },
          {
            type: "example",
            content: { text: "唔该晒", translation: "谢谢你" },
          },
        ],
      },
      {
        jyutping: "m4 goi1",
        language: "cmn",
        blocks: [
          { type: "definition", content: "劳驾" },
          { type: "audio", url: "https://example.com/cmn.wav" },
        ],
      },
      {
        jyutping: "do1 ze6",
        blocks: [
          { type: "sentence", content: "多谢" },
          { type: "definition", content: "不属于本表达" },
          { type: "audio", url: "https://example.com/other.wav" },
        ],
      },
    ],
  };
  const result = formatEntry({ ...row, structured_note: data });
  assert.equal(result.senses.length, 2);
  assert.equal(result.senses[0].audio, "https://example.com/yue.wav");
  assert.equal(result.senses[1].audio, null);
  assert.equal(result.senses[0].examples[0].audio, null);
  assert.equal(result.senses[0].examples[0].translation, "谢谢你");
  assert.equal("raw" in result, false);
});
test("explicit legacy Cantonese fields work without selecting generic or Mandarin audio", () => {
  assert.equal(
    formatEntry({
      ...row,
      note: {
        context: {
          粤语: "https://example.com/yue.wav",
          audio: "https://example.com/unknown.wav",
        },
      },
    }).senses[0].audio,
    "https://example.com/yue.wav",
  );
  assert.equal(
    formatEntry({
      ...row,
      note: { context: { audio: "https://example.com/unknown.wav" } },
    }).senses[0].audio,
    null,
  );
});
test("search validation escapes wildcard terms and binds cursor to query", () => {
  assert.throws(() => parseSearch(new URLSearchParams("q= ")));
  assert.throws(() => parseSearch(new URLSearchParams("q=x&limit=999")));
  const cursor = encodeCursor("唔该", 1, BigInt(42));
  assert.deepEqual(decodeCursor("唔该", cursor), { rank: 1, id: BigInt(42) });
  assert.throws(() => decodeCursor("多谢", cursor));
  assert.throws(() => decodeCursor("唔该", "not-a-cursor"));
});
test("feedback validates types, caps length, rejects claimed user IDs, and detects retry mismatch", () => {
  const input = {
    requestId: id,
    anonymousId: id,
    type: "other" as const,
    description: "  建议  ",
  };
  const v = feedbackInput.parse(input);
  assert.equal(v.description, "建议");
  assert.equal(
    feedbackInput.safeParse({ ...input, userId: "forged" }).success,
    false,
  );
  assert.equal(
    feedbackInput.safeParse({ ...input, description: "x".repeat(301) }).success,
    false,
  );
  const previous = {
    anonymous_id: id,
    user_id: null,
    entry_id: null,
    type: "other",
    description: "建议",
  };
  assert.ok(sameFeedback(previous, v, null));
  assert.equal(
    sameFeedback(previous, { ...v, description: "改了" }, null),
    false,
  );
  assert.equal(sameFeedback(previous, v, "another-user"), false);
});
test("new events preserve safe parameters without free text or signed URLs", () => {
  const props = {
    entryId: id,
    audioId: "/audio.wav",
    playSessionId: id,
    surface: "entry_detail",
    target: "expression",
    senseIndex: 0,
  };
  assert.deepEqual(parseClientEvent("audio_play", props), props);
  assert.equal(
    parseClientEvent("audio_play", { ...props, target: "example" }),
    null,
  );
  assert.equal(
    parseClientEvent("feedback_submit", {
      requestId: id,
      type: "other",
      status: "success",
    }),
    null,
  );
  assert.equal(
    parseClientEvent("audio_play", {
      ...props,
      audioId: "https://example.com/a.wav?token=secret",
    }),
    null,
  );
  assert.deepEqual(
    parseClientEvent("feedback_submit", {
      requestId: id,
      type: "other",
      status: "success",
      feedbackId: id,
      description: "private text",
    }),
    { requestId: id, type: "other", status: "success", feedbackId: id },
  );
  const batch = {
    anonymousId: id,
    sessionId: id,
    source: "miniprogram",
    app: "search-app",
    events: [{ name: "audio_play", props }],
  };
  assert.equal(ingestBatchSchema.safeParse(batch).success, true);
  assert.equal(
    ingestBatchSchema.safeParse({ ...batch, app: "made-up" }).success,
    false,
  );
});
test("Search analytics uses valid Beijing dates and a maximum 31-day window", () => {
  assert.equal(parseDays("2026-02-30", "2026-03-01"), null);
  assert.equal(parseDays("2026-01-01", "2026-02-02"), null);
  assert.equal(parseDays("2026-10-23", "2026-10-22"), null);
  assert.equal(
    parseDays("2026-10-23", "2026-10-23")?.start.toISOString(),
    "2026-10-22T16:00:00.000Z",
  );
});
