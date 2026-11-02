# App Store rollout and verification

Feature branch: `codex/s8-app-store`, based on `origin/dev` at `e9ceec5`.
Product scope and decisions live in the ai-docs DimSum S8 records.

## Data changes

The existing application IDs and published legacy fields are preserved. Three new tables hold display drafts/public snapshots, account favorites, and append-only operation history. A reviewed live-schema introspection is included because dev was missing existing ingestion tables and the `ingestion_task_id` relation; these are baseline synchronization, not new App Store functionality. The ingestion-leads response serializes that existing BigInt relation as a string.

No production data or schema is changed by building this branch. Writes are disabled unless `APP_STORE_WRITES_ENABLED=true`.

## Release order

1. Keep writes disabled. Run the repository's normal **db pull → review database-to-schema diff → db push** workflow. Preserve any newer unrelated live changes. The App Store delta should contain only three tables, two indexes and three foreign keys; do not accept drops or unrelated alterations.
2. Execute `enable-rls.sql` after reviewing it. It enables RLS with no public policies on the three private tables and exposes a deliberately limited legacy view. The view uses the legacy public fields only, excludes draft/offline items, and never includes draft JSON or actor data.
3. Deploy the Deno `/corpus_apps` change and verify it reads `app_store_public_legacy`. **Do not enable new application writes while the old unfiltered endpoint is live.** Verify any direct consumers of the old table/API as part of release acceptance.
4. Deploy Next.js with the new Prisma client. Verify anonymous public lists, administrator access and account favorites. Then enable `APP_STORE_WRITES_ENABLED=true` only in the approved environment.
5. Test a disposable draft, publish, edit-without-publish, offline and favorite/unfavorite flow in that environment with explicit authorization. Check that neither public endpoint exposes the draft or an offline entry.

Existing rows without a profile remain publicly visible as before. Their access/login/device requirements are explicitly “not specified”; no unverified claims are backfilled. Creating/editing profiles is incremental.

The write switch also covers favorites and media uploads. Account merges use table-readiness detection independently, so disabling new writes after rollout does not strand existing favorites. Disable writes before rollback; keep the safe legacy projection while any private/offline entries exist. Reverting to the old unfiltered Deno endpoint is not a safe rollback.

## Verification

- `npm run test:app-store`: URL policy, legacy categories/content, publication requirements and combined search/filter/order behavior.
- `scripts/app-store/integration-test.ts`: real transaction checks for drafts, old/public visibility, stale revision conflicts, administrator rights, favorite idempotency, inactive accounts, account favorite merging and offline privacy. This script **refuses non-local targets**; it requires `APP_STORE_LOCAL_TEST=true` and a disposable PostgreSQL database on `127.0.0.1:55438` with the necessary existing User/application and three new tables. It never loads production credentials itself.
- TypeScript and the normal production build. Local build needs a Resend configuration value because an existing unrelated email route initializes its client at module load; do not invoke email endpoints during local validation.

Media uploads reuse OSS with a dedicated App Store purpose and a 4 MB limit. Larger demo videos use an operator-provided URL. Files are only uploaded by a platform administrator, not fetched from arbitrary URLs by the server.

Browser QA used synthetic accounts and application rows in an isolated local database. Local proxy/session fixtures are outside the repository and must never be deployed. Desktop and a 390 × 844 responsive viewport were checked; physical iPhone Safari, real OSS uploads and production rollout remain separate acceptance steps.
