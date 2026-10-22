/** #506 transaction-only integration checks. All QA users, grants and objects are rolled back. */
import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
if (process.env.DIRECT_URL) {
  const url = new URL(process.env.DIRECT_URL);
  url.searchParams.set("connect_timeout", "30");
  url.searchParams.set("connection_limit", "1");
  process.env.DATABASE_URL = url.href;
}
async function main() {
  const { prisma } = await import("@/lib/prisma");
  const { configureGrant } = await import("@/lib/admin/grants");
  const { loadAdminAccess, assertDataset, datasetWhere, grantCreatedObject } =
    await import("@/lib/admin/access");
  const { canScope, canCreate, hasDatasetAdmin } = await import(
    "@/lib/admin/policy"
  );
  const { createActivityWithDataset } = await import(
    "@/lib/dataset-management"
  );
  const { computeSnapshot } = await import("@/lib/analytics/corpus-assets");
  const { randomUUID } = await import("node:crypto");
  const rollback = new Error("QA_ROLLBACK_506");
  const results: string[] = [];
  try {
    const rls = await prisma.$queryRaw<
      Array<{ relname: string; relrowsecurity: boolean }>
    >`SELECT relname,relrowsecurity FROM pg_class WHERE oid IN ('public.admin_business_roles'::regclass,'public.admin_scope_grants'::regclass)`;
    assert.equal(rls.length, 2);
    assert.ok(rls.every((r) => r.relrowsecurity));
    results.push("new permission tables have RLS");
    await prisma
      .$transaction(
        async (tx) => {
          const platform = await tx.user.findFirst({
            where: { status: "ACTIVE", isSuperAdmin: true },
            select: { id: true },
          });
          assert.ok(platform);
          const suffix = randomUUID();
          const manager = await tx.user.create({
            data: { name: `#506 QA manager ${suffix}`, status: "ACTIVE" },
          });
          const operator = await tx.user.create({
            data: { name: `#506 QA operator ${suffix}`, status: "ACTIVE" },
          });
          const dataset = await tx.cantonese_categories.findUnique({
            where: { name: "internal-test" },
            select: { id: true, name: true },
          });
          assert.ok(dataset);
          const other = await tx.cantonese_categories.findFirst({
            where: { name: { not: "internal-test" } },
            select: { id: true, name: true },
          });
          assert.ok(other);
          const business = {
            kind: "business" as const,
            userId: manager.id,
            role: "DATASET_ADMIN" as const,
            active: true,
            note: "transaction-only QA",
          };
          await configureGrant(tx, platform.id, business);
          let a = await loadAdminAccess(manager.id, tx);
          assert.ok(canCreate(a, "dataset"));
          assert.ok(hasDatasetAdmin(a));
          assert.equal(canScope(a, "dataset", dataset.id), false);
          await configureGrant(tx, platform.id, {
            kind: "scope",
            userId: manager.id,
            scopeType: "dataset",
            scopeId: String(dataset.id),
            role: "ADMIN",
            actions: [],
            active: true,
            note: "QA",
          });
          const opGrant = {
            kind: "scope" as const,
            userId: operator.id,
            scopeType: "dataset" as const,
            scopeId: String(dataset.id),
            role: "OPERATOR" as const,
            actions: [],
            active: true,
            note: "QA",
          };
          await configureGrant(tx, manager.id, opGrant);
          a = await loadAdminAccess(operator.id, tx);
          assert.ok(canScope(a, "dataset", dataset.id, "operate"));
          assert.equal(canScope(a, "dataset", other.id, "operate"), false);
          assert.equal(canScope(a, "dataset", dataset.id, "manage"), false);
          assert.equal(hasDatasetAdmin(a), false);
          await assert.rejects(assertDataset(a, other.name, "operate", tx));
          const visible = await tx.cantonese_categories.findMany({
            where: datasetWhere(a),
            select: { name: true },
          });
          assert.deepEqual(
            visible.map((d) => d.name),
            ["internal-test"],
          );
          const snapshot = await computeSnapshot(
            tx,
            visible.map((d) => d.name),
          );
          assert.equal(snapshot.overview.datasets, 1);
          assert.equal(snapshot.overview.entries, 20);
          assert.equal(snapshot.datasets[0].name, "internal-test");
          results.push(
            "dataset on/off grant, substitution denial, scoped list and scoped snapshot (20 entries)",
          );
          await assert.rejects(
            configureGrant(tx, manager.id, { ...opGrant, role: "ADMIN" }),
          );
          await assert.rejects(
            configureGrant(tx, manager.id, {
              ...opGrant,
              scopeId: String(other.id),
            }),
          );
          results.push("peer escalation and out-of-scope grant denied");
          await configureGrant(tx, manager.id, { ...opGrant, active: false });
          assert.equal(
            canScope(
              await loadAdminAccess(operator.id, tx),
              "dataset",
              dataset.id,
            ),
            false,
          );
          results.push("revocation takes effect on next access load");
          const created = await tx.cantonese_categories.create({
            data: {
              name: `qa-506-${suffix}`,
              created_by: manager.id,
              is_public: false,
            },
          });
          await grantCreatedObject(tx, manager.id, "dataset", created.id);
          assert.ok(
            canScope(
              await loadAdminAccess(manager.id, tx),
              "dataset",
              created.id,
              "manage",
            ),
          );
          assert.equal(
            canScope(
              await loadAdminAccess(operator.id, tx),
              "dataset",
              created.id,
            ),
            false,
          );
          results.push(
            "creator auto-grant, existing operators do not inherit new objects",
          );
          await configureGrant(tx, platform.id, {
            kind: "business",
            userId: manager.id,
            role: "ACTIVITY_ADMIN",
            active: true,
            note: "QA",
          });
          const key = randomUUID();
          const data = {
            title: `QA #506 ${suffix}`,
            created_by: manager.id,
            status: "draft",
          };
          const first = await createActivityWithDataset(tx, data, "oral", key);
          assert.ok(
            canScope(
              await loadAdminAccess(manager.id, tx),
              "activity",
              first.activity.id,
              "manage",
            ),
          );
          assert.equal(
            (await createActivityWithDataset(tx, data, "oral", key)).replayed,
            true,
          );
          await configureGrant(tx, platform.id, {
            kind: "scope",
            userId: manager.id,
            scopeType: "activity",
            scopeId: String(first.activity.id),
            role: "ADMIN",
            actions: [],
            active: false,
            note: "QA",
          });
          await assert.rejects(
            createActivityWithDataset(tx, data, "oral", key),
          );
          results.push(
            "activity creation is scoped and replay cannot bypass revoked scope",
          );
          await configureGrant(tx, platform.id, { ...business, active: false });
          assert.equal(
            hasDatasetAdmin(await loadAdminAccess(manager.id, tx)),
            false,
          );
          assert.equal(
            canScope(
              await loadAdminAccess(manager.id, tx),
              "dataset",
              dataset.id,
              "manage",
            ),
            false,
          );
          results.push(
            "business-role revocation removes intake capability and admin scopes",
          );
          throw rollback;
        },
        { timeout: 90000 },
      )
      .catch((e) => {
        if (e !== rollback) throw e;
      });
    const qa = await prisma.user.count({
      where: { name: { startsWith: "#506 QA " } },
    });
    assert.equal(qa, 0);
    results.push("all QA writes rolled back");
    console.log(JSON.stringify({ passed: true, checks: results }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
