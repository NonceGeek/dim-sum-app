import assert from "node:assert/strict";
import test from "node:test";
import { parseContentAttribute, parseDatasetUpdate } from "./dataset-management";

test("new datasets require an explicit supported attribute", () => {
  for (const value of [undefined, null, "", "unclassified", "video", 1]) assert.throws(() => parseContentAttribute(value));
  assert.equal(parseContentAttribute("oral"), "oral");
  assert.equal(parseContentAttribute("cultural_knowledge"), "cultural_knowledge");
});

test("aliases are trimmed while the stable key cannot be edited", () => {
  assert.deepEqual(parseDatasetUpdate({ name: "stable", nickname: "  昵称  ", description: "说明" }), { nickname: "昵称", description: "说明" });
  assert.throws(() => parseDatasetUpdate({ nickname: "  " }));
  assert.throws(() => parseDatasetUpdate({ nickname: "字".repeat(101) }));
  assert.throws(() => parseDatasetUpdate({ contentAttribute: "unclassified" }));
  assert.throws(() => parseDatasetUpdate({ is_public: "false" }));
  assert.throws(() => parseDatasetUpdate({ name: "new-key" }));
});
