/** #506 additive migration. Dry-run by default; --apply writes new grants only. */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
// A single session connection is sufficient; never alter application configuration.
if (process.env.DIRECT_URL) {
  const url = new URL(process.env.DIRECT_URL);
  url.searchParams.set("connection_limit", "1");
  url.searchParams.set("connect_timeout", "30");
  process.env.DATABASE_URL = url.href;
}
async function main() {
  const { prisma } = await import("@/lib/prisma");
  const { legacyActivityGrant } = await import("@/lib/admin/legacy-mapping");
  const { jsonSnapshot } = await import("@/lib/admin/security");
  try {
    const roles = await prisma.corpus_collection_operator_roles.findMany();
    if (roles.some((r) => r.global_actions.length))
      throw new Error(
        "Legacy global actions require explicit mapping review; refusing automatic widening to DATASET_ADMIN",
      );
    const permissions =
      await prisma.corpus_collection_activity_permissions.findMany();
    const planned = permissions.flatMap((p) => {
      const grant = legacyActivityGrant(
        roles.find((r) => r.user_id === p.user_id),
        p.submission_actions,
      );
      return grant
        ? [
            {
              userId: p.user_id,
              activityId: String(p.activity_id),
              grantedBy:
                p.assigned_by ??
                roles.find((r) => r.user_id === p.user_id)?.assigned_by ??
                "migration:#506",
              ...grant,
            },
          ]
        : [];
    });
    console.log(
      JSON.stringify({
        legacyRoles: roles.length,
        legacyActivityPermissions: permissions.length,
        plannedScopedOperators: planned.length,
        apply: process.argv.includes("--apply"),
      }),
    );
    if (!process.argv.includes("--apply")) return;
    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('admin-scope-migration-506',0))::text`;
        let inserted = 0;
        for (const p of planned) {
          // A replay must not restore a scope that was later changed or revoked.
          const result = await tx.admin_scope_grants.createMany({
            skipDuplicates: true,
            data: [
              {
                user_id: p.userId,
                scope_type: "activity",
                scope_id: p.activityId,
                role: p.role,
                actions: p.actions,
                granted_by: p.grantedBy,
                note: "#506 migration: preserve #479 activity actions; no business-admin qualification",
              },
            ],
          });
          inserted += result.count;
        }
        if (inserted)
          await tx.corpus_collection_audit_logs.create({
            data: {
              operator_id: "migration:#506",
              operator_role: "SYSTEM_MIGRATION",
              action: "admin.scope.legacy_migrated",
              scope_type: "activity",
              result_summary: jsonSnapshot({
                inserted,
                grants: planned,
                platformFlagsChanged: false,
                annotationGrantsChanged: false,
                questionnaireGrantsChanged: false,
              }),
            },
          });
        console.log(
          JSON.stringify({
            inserted,
            skippedExisting: planned.length - inserted,
          }),
        );
      },
      { timeout: 30000 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
