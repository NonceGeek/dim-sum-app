import assert from "node:assert/strict";
import test from "node:test";
import { buildTagEmbeddingInput } from "./tag-embeddings";

test("tag embedding input matches embed_tags.py format", () => {
  assert.equal(buildTagEmbeddingInput("饮茶", "scene", "去茶楼食点心"), "「饮茶」（场景）：去茶楼食点心");
  assert.equal(buildTagEmbeddingInput("新标签", "other", "用户自建"), "「新标签」：用户自建");
  assert.equal(buildTagEmbeddingInput("无释义", "other", null), "「无释义」：");
});
