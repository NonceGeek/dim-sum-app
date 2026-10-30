import assert from "node:assert/strict";
import test from "node:test";
import { assertDataset, loadAdminAccess } from "./access";
import { configureGrant } from "./grants";
import {
  canActivityAction,
  canCreate,
  canGrantScope,
  canScope,
  hasDatasetAdmin,
  scopeIds,
  type AdminAccess,
} from "./policy";
import { AccessError } from "./security";
const access = (changes: Partial<AdminAccess> = {}): AdminAccess => ({
  userId: "u",
  isPlatformAdmin: false,
  isSuperAdmin: false,
  businessRoles: [],
  grants: [],
  ...changes,
});
const operator = access({
  grants: [
    { scopeType: "dataset", scopeId: "7", role: "OPERATOR", actions: [] },
    {
      scopeType: "activity",
      scopeId: "10",
      role: "OPERATOR",
      actions: ["view", "approve"],
    },
  ],
});
const manager = access({
  businessRoles: ["DATASET_ADMIN", "ACTIVITY_ADMIN"],
  grants: [
    { scopeType: "dataset", scopeId: "7", role: "ADMIN", actions: [] },
    { scopeType: "activity", scopeId: "10", role: "ADMIN", actions: [] },
  ],
});
test("dataset operations are all or nothing on their assigned dataset, never management or cross-scope", () => {
  assert.ok(canScope(operator, "dataset", 7, "operate"));
  assert.ok(canScope(operator, "dataset", 7));
  assert.equal(canScope(operator, "dataset", 8, "operate"), false);
  assert.equal(canScope(operator, "dataset", 7, "manage"), false);
  assert.equal(canCreate(operator, "dataset"), false);
  assert.equal(hasDatasetAdmin(operator), false);
});
test("creation qualification does not grant historical or future objects", () => {
  const qualified = access({ businessRoles: ["DATASET_ADMIN"] });
  assert.ok(canCreate(qualified, "dataset"));
  assert.deepEqual(scopeIds(qualified, "dataset"), []);
  assert.equal(canScope(qualified, "dataset", 7, "manage"), false);
  assert.ok(hasDatasetAdmin(qualified));
  assert.equal(canCreate(qualified, "activity"), false);
});
test("one UID can hold different roles in different objects; activity actions remain scoped", () => {
  const mixed = access({
    ...manager,
    grants: [
      ...manager.grants,
      { scopeType: "dataset", scopeId: "8", role: "OPERATOR", actions: [] },
    ],
  });
  assert.ok(canScope(mixed, "dataset", 7, "manage"));
  assert.equal(canScope(mixed, "dataset", 8, "manage"), false);
  assert.ok(canScope(mixed, "dataset", 8, "operate"));
  assert.ok(canActivityAction(operator, "10", "approve"));
  assert.equal(canActivityAction(operator, "10", "reject"), false);
  assert.equal(canActivityAction(operator, "11", "approve"), false);
  assert.equal(
    canActivityAction(
      access({
        grants: [
          {
            scopeType: "activity",
            scopeId: "10",
            role: "OPERATOR",
            actions: ["approve"],
          },
        ],
      }),
      "10",
      "approve",
    ),
    false,
  );
});
test("business admins cannot grant same-level roles, edit a peer admin, or grant outside scope", () => {
  assert.ok(canGrantScope(manager, "dataset", "7", "OPERATOR"));
  assert.equal(canGrantScope(manager, "dataset", "7", "ADMIN"), false);
  assert.equal(
    canGrantScope(manager, "dataset", "7", "OPERATOR", "ADMIN"),
    false,
  );
  assert.equal(canGrantScope(manager, "dataset", "8", "OPERATOR"), false);
  assert.ok(
    canGrantScope(access({ isPlatformAdmin: true }), "dataset", "8", "ADMIN"),
  );
});
test("revoking a business role removes inherited admin access without enabling operator capabilities", () => {
  const revoked = { ...manager, businessRoles: [] };
  assert.equal(canScope(revoked, "dataset", 7, "manage"), false);
  assert.equal(hasDatasetAdmin(revoked), false);
  const removed = { ...operator, grants: [] };
  assert.equal(canScope(removed, "dataset", 7), false);
});
test("every access load reads current rows and account status; stale claims cannot authorize", async () => {
  const row: any = {
    status: "ACTIVE",
    isSuperAdmin: false,
    isSystemAdmin: false,
    adminBusinessRoles: [],
    adminScopeGrants: [
      {
        scope_type: "dataset",
        scope_id: "7",
        role: "OPERATOR",
        actions: [],
        revoked_at: null,
      },
    ],
  };
  let reads = 0;
  const db: any = {
    user: {
      findUnique: async () => {
        reads++;
        return row;
      },
    },
  };
  assert.ok(canScope(await loadAdminAccess("u", db), "dataset", 7));
  row.adminScopeGrants[0].revoked_at = new Date();
  assert.equal(canScope(await loadAdminAccess("u", db), "dataset", 7), false);
  row.status = "DELETED";
  row.isSystemAdmin = true;
  await assert.rejects(loadAdminAccess("u", db), AccessError);
  assert.equal(reads, 3);
});
test("direct dataset name substitution is denied before mutation", async () => {
  const db: any = {
    cantonese_categories: {
      findUnique: async () => ({ id: BigInt(8), name: "other" }),
    },
  };
  await assert.rejects(
    assertDataset(operator, "other", "operate", db),
    (e: unknown) => e instanceof AccessError && e.status === 403,
  );
});
test("permission service rejects self escalation, peer edits and out-of-scope grants without writes", async () => {
  let writes = 0;
  const actorRow = {
    status: "ACTIVE",
    isSuperAdmin: false,
    isSystemAdmin: false,
    adminBusinessRoles: manager.businessRoles.map((role) => ({
      role,
      active: true,
    })),
    adminScopeGrants: manager.grants.map((g) => ({
      scope_type: g.scopeType,
      scope_id: g.scopeId,
      role: g.role,
      actions: g.actions,
      revoked_at: null,
    })),
  };
  const db: any = {
    $queryRaw: async () => [],
    user: {
      findUnique: async ({ where }: any) =>
        where.id === "u"
          ? actorRow
          : { status: "ACTIVE", isSystemAdmin: false, isSuperAdmin: false },
    },
    admin_scope_grants: {
      findUnique: async () => null,
      upsert: async () => {
        writes++;
      },
    },
    admin_business_roles: {
      upsert: async () => {
        writes++;
      },
    },
  };
  const base = {
    kind: "scope" as const,
    userId: "target",
    scopeType: "dataset" as const,
    scopeId: "7",
    role: "OPERATOR" as const,
    active: true,
    actions: [],
    note: "test",
  };
  for (const input of [
    { ...base, scopeId: "8" },
    { ...base, userId: "u" },
    { ...base, role: "ADMIN" as const },
    {
      kind: "business" as const,
      userId: "target",
      role: "DATASET_ADMIN" as const,
      active: true,
      note: "test",
    },
  ])
    await assert.rejects(configureGrant(db, "u", input), AccessError);
  db.admin_scope_grants.findUnique = async () => ({
    role: "ADMIN",
    revoked_at: null,
  });
  await assert.rejects(configureGrant(db, "u", base), AccessError);
  assert.equal(writes, 0);
});
