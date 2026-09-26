import test from "node:test";
import assert from "node:assert/strict";
import {
  collectionUserSearchWhere,
  userSearchSummary,
} from "./collection-user-search";
test("user lookup excludes inactive users, supports exact UID and partial contact/name search", () => {
  const where = collectionUserSearchWhere("fynn");
  assert.equal(where.status, "ACTIVE");
  const filters = where.OR as any[];
  assert.deepEqual(
    filters.find((f) => f.id),
    { id: { equals: "fynn" } },
  );
  assert.ok(filters.find((f) => f.name)?.name.contains === "fynn");
  assert.ok(filters.find((f) => f.email)?.email.mode === "insensitive");
  assert.ok(
    filters.find((f) => f.phoneNumber)?.phoneNumber.contains === "fynn",
  );
});
test("search results provide disambiguation without full contact details", () => {
  const result = userSearchSummary({
    id: "test",
    name: "Example",
    email: "example@example.com",
    phoneNumber: "13812345678",
    isSystemAdmin: false,
    isSuperAdmin: true,
  });
  assert.equal(result.phoneHint, "138****5678");
  assert.equal(result.emailHint, "e***@example.com");
  assert.equal(result.isSystemAdmin, true);
  assert.equal("email" in result, false);
  assert.equal("phoneNumber" in result, false);
});
test("missing and short contacts are safe to display", () => {
  const base = {
    id: "test",
    name: null,
    email: null,
    phoneNumber: null,
    isSystemAdmin: false,
    isSuperAdmin: false,
  };
  assert.equal(userSearchSummary(base).emailHint, null);
  assert.equal(userSearchSummary(base).phoneHint, null);
  assert.equal(
    userSearchSummary({ ...base, phoneNumber: "123" }).phoneHint,
    "****",
  );
});
