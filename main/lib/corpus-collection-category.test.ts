import assert from "node:assert/strict";
import test from "node:test";
import {
  getNextCategorySortOrder,
  isCorpusCollectionCategoryType,
  parseCategoryOrder,
} from "./corpus-collection-category";

test("new categories append after the current maximum sort order", () => {
  assert.equal(getNextCategorySortOrder(null), 0);
  assert.equal(getNextCategorySortOrder(0), 1);
  assert.equal(getNextCategorySortOrder(5), 6);
});

test("only supported category types are accepted", () => {
  assert.equal(isCorpusCollectionCategoryType("submission_type"), true);
  assert.equal(isCorpusCollectionCategoryType("tag"), true);
  assert.equal(isCorpusCollectionCategoryType("other"), false);
});

test("category reorder ids must be unique positive integer strings", () => {
  assert.deepEqual(parseCategoryOrder(["3", "1", "2"]), [BigInt(3), BigInt(1), BigInt(2)]);
  assert.throws(() => parseCategoryOrder([]));
  assert.throws(() => parseCategoryOrder(["1", "1"]));
  assert.throws(() => parseCategoryOrder(["0"]));
  assert.throws(() => parseCategoryOrder(["invalid"]));
});
