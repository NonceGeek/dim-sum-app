import assert from "node:assert/strict";
import test from "node:test";
import { legacyActivityGrant } from "./legacy-mapping";
test("legacy ADMIN is only a preset and must never migrate to object ADMIN or creation qualification", () => {
  assert.deepEqual(
    legacyActivityGrant({ active: true, role_code: "ACTIVITY_ADMIN" }, [
      "view",
      "approve",
    ]),
    { role: "OPERATOR", actions: ["view", "approve"] },
  );
  for (const role of [
    undefined,
    { active: false, role_code: "ACTIVITY_OPERATOR" },
    { active: true, role_code: "unknown" },
  ])
    assert.equal(legacyActivityGrant(role, ["view"]), null);
  assert.equal(
    legacyActivityGrant({ active: true, role_code: "ACTIVITY_REVIEWER" }, [
      "approve",
    ]),
    null,
  );
  assert.equal(
    legacyActivityGrant({ active: true, role_code: "ACTIVITY_REVIEWER" }, [
      "view",
      "unknown",
    ]),
    null,
  );
});
