import test from "node:test";
import assert from "node:assert/strict";
import {
  singleSearchUser,
  managementTypes,
  isAlreadyAdmin,
  scopeLabel,
  type PermissionData,
  type PermissionChange,
} from "./permission-ui";
import { savePermissionChanges } from "./permission-ui-save";
const data: PermissionData = {
  isPlatformAdmin: false,
  roles: [],
  grants: [
    { scope_type: "activity", scope_id: "22", role: "ADMIN", actions: [] },
  ],
  datasets: [],
  activities: [
    { id: "22", title: "同名活动" },
    { id: "23", title: "同名活动" },
  ],
};
const change = (
  scopeId: string,
  role: "ADMIN" | "OPERATOR" = "ADMIN",
): PermissionChange => ({
  kind: "scope",
  scopeType: "activity",
  scopeId,
  role,
  actions: role === "OPERATOR" ? ["view"] : [],
  active: true,
});
const response = (value: unknown, status = 200) =>
  Response.json(value, { status });

test("auto-select only a complete single match, never a truncated or ambiguous result", () => {
  const user = { id: "one", name: "User" };
  assert.equal(singleSearchUser({ users: [user], hasMore: false })?.id, "one");
  assert.equal(singleSearchUser({ users: [user], hasMore: true }), null);
  assert.equal(singleSearchUser({ users: [user] }), null);
  assert.equal(singleSearchUser({ users: [], hasMore: false }), null);
  assert.equal(
    singleSearchUser({
      users: [user, { id: "two", name: "Other" }],
      hasMore: false,
    }),
    null,
  );
});
test("actor visibility is limited to managed content; platform admins see both types", () => {
  assert.deepEqual(managementTypes(data), ["activity"]);
  assert.deepEqual(managementTypes({ ...data, isPlatformAdmin: true }), [
    "dataset",
    "activity",
  ]);
  assert.deepEqual(managementTypes({ ...data, activities: [] }), []);
  assert.equal(scopeLabel(data, "activity", "22"), "#22 同名活动");
  assert.equal(scopeLabel(data, "activity", "23"), "#23 同名活动");
  assert.equal(isAlreadyAdmin(data, "activity", "22"), true);
  assert.equal(isAlreadyAdmin(data, "dataset", "22"), false);
});
test("batch admin assignment keeps string IDs and recipient, reports partial failure and continues", async () => {
  const writes: any[] = [];
  const request: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    writes.push(body);
    return body.scopeId === "23"
      ? response({ error: "No longer allowed" }, 403)
      : response({ success: true });
  };
  const results = await savePermissionChanges(
    "recipient",
    [change("22"), change("23"), change("9007199254740993")],
    "Reason",
    request,
  );
  assert.deepEqual(
    results.map((r) => r.ok),
    [true, false, true],
  );
  assert.equal(results[1].error, "No longer allowed");
  assert.ok(
    writes.every(
      (body) => body.userId === "recipient" && body.note === "Reason",
    ),
  );
  assert.equal(writes[2].scopeId, "9007199254740993");
  assert.ok(writes.every((body) => body.kind === "scope"));
});
test("operator saves recheck existing assignments and do not downgrade an admin", async () => {
  let puts = 0;
  const request: typeof fetch = async (_url, init) => {
    if (init?.method === "PUT") {
      puts++;
      return response({ success: true });
    }
    return response(data);
  };
  const results = await savePermissionChanges(
    "u",
    [change("22", "OPERATOR"), change("23", "OPERATOR")],
    "",
    request,
  );
  assert.deepEqual(
    results.map((r) => r.ok),
    [false, true],
  );
  assert.equal(puts, 1);
});
test("failed preflight never writes; revoking a role remains one original business API operation", async () => {
  const methods: string[] = [];
  const request: typeof fetch = async (_url, init) => {
    methods.push(init?.method ?? "GET");
    return response({ error: "Access revoked" }, 403);
  };
  const result = await savePermissionChanges(
    "u",
    [change("23", "OPERATOR")],
    "",
    request,
  );
  assert.deepEqual(methods, ["GET"]);
  assert.equal(result[0].ok, false);
  const writes: any[] = [];
  const role: PermissionChange = {
    kind: "business",
    role: "ACTIVITY_ADMIN",
    active: false,
  };
  await savePermissionChanges("u", [role], "revoke", async (_url, init) => {
    writes.push(JSON.parse(String(init?.body)));
    return response({ success: true });
  });
  assert.deepEqual(writes, [{ ...role, userId: "u", note: "revoke" }]);
});
