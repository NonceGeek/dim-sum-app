import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCorpusEmbeddingUnits,
  diffEmbeddingUnits,
  md5,
  parseStructuredNote,
} from "./corpus-embeddings";

const note = (blocks: Array<Record<string, unknown>>) => ({ data: [{ blocks }] });

function units(data: string, category: string, structuredNote: unknown) {
  const parsed = parseStructuredNote(structuredNote);
  assert.ok(parsed);
  return buildCorpusEmbeddingUnits(data, category, parsed);
}

test("empty or unembeddable structured notes yield nothing", () => {
  for (const raw of [null, "", "null", "{}", {}, { data: [] }, "not json", note([{ type: "sentence", content: "  " }])]) {
    assert.equal(parseStructuredNote(raw), null);
  }
});

test("units match embed_corpus.py: doc concat, headword categories, sentence/definition", () => {
  const sn = note([
    { type: "definition", content: "喝茶" },
    { type: "sentence", content: "去饮茶" },
    { type: "introduction", content: "饮茶" },
  ]);
  assert.deepEqual(
    units(" 饮茶 ", "yywj2", sn).map((unit) => [unit.fieldType, unit.modality, unit.contentRef]),
    [
      ["doc", "text", "「饮茶」 去饮茶 喝茶"],
      ["headword", "text", "饮茶"],
      ["sentence", "text", "去饮茶"],
      ["definition", "text", "喝茶"],
    ],
  );
  assert.deepEqual(units("饮茶", "other", sn).map((unit) => unit.fieldType), ["doc", "sentence", "definition"]);
  // String-encoded JSON is accepted as well.
  assert.equal(units("饮茶", "other", JSON.stringify(sn)).length, 3);
});

test("duplicates are dropped and refs are stored on one line", () => {
  const result = units("", "other", note([
    { type: "sentence", content: "第一行\n第二行" },
    { type: "sentence", content: "第一行\t第二行" },
  ]));
  assert.deepEqual(result.map((unit) => [unit.fieldType, unit.contentRef]), [
    ["doc", "第一行 第二行 第一行 第二行"],
    ["sentence", "第一行 第二行"],
  ]);
  assert.equal(result[1].embedInput, "第一行\n第二行");
});

test("media uses valid urls and same-unit description", () => {
  const result = units("", "other", note([
    { type: "image", url: "https://x/a.png" },
    { type: "video", url: "hhttp://x/b.mp4" },
    { type: "image", url: "ftp://x/c.png" },
    { type: "introduction", content: "茶楼" },
  ]));
  assert.deepEqual(result.map((unit) => [unit.fieldType, unit.contentRef, unit.mediaDesc]), [
    ["doc", "茶楼", null],
    ["image", "https://x/a.png", "茶楼"],
  ]);
});

test("diff by field_type + md5(content_ref)", () => {
  const desired = units("饮茶", "other", note([{ type: "sentence", content: "去\n饮茶" }]));
  const stored = desired.map((unit, index) => ({ id: BigInt(index + 1), fieldType: unit.fieldType, refMd5: md5(unit.contentRef) }));

  assert.deepEqual(diffEmbeddingUnits(desired, stored), { toInsert: [], toDeleteIds: [] });
  assert.deepEqual(diffEmbeddingUnits(desired, []).toInsert, desired);
  assert.deepEqual(diffEmbeddingUnits([], stored).toDeleteIds, [BigInt(1), BigInt(2)]);

  const edited = units("饮茶", "other", note([{ type: "sentence", content: "去饮早茶" }]));
  const diff = diffEmbeddingUnits(edited, stored);
  assert.deepEqual(diff.toInsert.map((unit) => unit.contentRef), ["「饮茶」 去饮早茶", "去饮早茶"]);
  assert.deepEqual(diff.toDeleteIds, [BigInt(1), BigInt(2)]);
});

test("md5 hashes utf-8 like postgres md5(text)", () => {
  // Reference value from Python hashlib.md5(s.encode()), which hashes the same UTF-8 bytes as Postgres.
  assert.equal(md5("「饮茶」 去饮茶"), "70e25cf4058a29036f39daaa1081e121");
});
