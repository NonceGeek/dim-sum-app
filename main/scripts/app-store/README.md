# App Store rollout and verification

## Current architecture — independent service (2026-11-02)

App Store uses the same-origin Next.js API `GET /api/app-store/apps`, platform-admin `/api/admin/applications` APIs and account `/api/user/app-favorites`. The external Deno `/corpus_apps` service has been **replaced as the App Store data source**. This does not retire the server or its unrelated corpus APIs. No Deno deployment is required for the new App Store.

`app_store_profiles` is now the application master table: its own auto-incrementing ID, private draft, public snapshot, status and revision. Favorites reference this table directly. Audits remain append-only. Only three App Store tables are used; no fourth table is added. Runtime APIs neither read nor write `cantonese_corpus_apps`, and there is no fallback to the old service.

The one-time import retains the 24 legacy application IDs and public content. The old table, old endpoint and compatibility view are historical data: new edits, new applications and offline state do not synchronize back. Legacy consumers will see stale historical content and should migrate to the same-origin API. Do not describe the old endpoint as current or use it to validate new publication state.

New applications, drafts, publication and offline transitions exist only in the new tables, so the old unfiltered service cannot reveal new drafts or newly published content. Public output is parsed from `published_data` only. Old entries with missing launch details retain their original data; new publication requires valid fields.

## Release order

1. Keep `APP_STORE_WRITES_ENABLED` disabled. Pull the live schema into a separate temporary file and review the database-to-target diff without overwriting the feature target. For the independent-storage update, the delta removes two legacy foreign keys, creates the profile ID sequence/default, and retargets the favorites foreign key. No legacy rows, tables or columns are deleted. If existing favorites are present, seed their profile targets before changing the foreign key; do not force past foreign-key failures.
2. Apply the reviewed `prisma db push --skip-generate`, then run `enable-rls.sql`. It protects all private tables and ID sequences. Its legacy view is historical only, with no join to current publication state.
3. Run `node --import tsx scripts/app-store/import-legacy.ts` for an import preview; add `--apply` for the authorized import. It inserts missing IDs, preserves all existing profiles, and advances the independent sequence beyond the maximum profile ID. Run before enabling writes. Re-running with unchanged historical data imports zero records; this is not a continuing synchronization job.
4. Verify imported IDs/counts, old-table integrity, RLS/grants, sequence position and an empty database-to-target diff. Do not create production fixtures for these checks.
5. Deploy Next.js with the generated Prisma client; verify visitors can load the catalog and administrators/account users retain their own access boundaries. Enable `APP_STORE_WRITES_ENABLED=true` in the approved environment only after schema/import/read checks pass. Verify publish, draft isolation, offline and favorites with an explicitly authorized acceptance record.

The write switch covers admin edits, favorites and media uploads. Account merges preserve existing favorites independently of the write switch. Disabling new writes must not strand existing favorites.

## Verification

- `npm run test:app-store`: URL policies, legacy parsing, filters, publication rules and mobile/desktop WeChat launch selection.
- `npm run test:app-store:anonymous`: actual local HTTP checks without session cookies. Published catalog GET returns 200; POST, adjacent paths, admin and favorites remain 401. Use localhost:3006, not the synthetic-session proxy.
- `APP_STORE_LOCAL_TEST=true npm run test:app-store:local`: isolated PostgreSQL only (127.0.0.1:55438). Imports historical records, temporarily renames the old table, and verifies the full lifecycle still works without it. Covers import idempotency, draft/public isolation, admin rights, stale revisions, favorites/account merges and offline privacy; restores the old table and verifies it is unchanged.
- TypeScript and the normal production build. Local build uses a non-sending placeholder because an existing email module initializes its client at build time; do not invoke email endpoints.

Media uploads reuse OSS and platform-admin permissions. Valid phone/desktop WeChat links must be supplied and tested; QR-only entries remain supported. Desktop/mobile browser QA is not physical-device acceptance.

## Execution history

2026-11-02: initially applied the three new tables, two indexes and three foreign keys after pull/diff/push; enabled RLS and the then-required filtering view. Legacy count 24 and full-row SHA-256 were unchanged (`e30311639e0e119d01df4582b2e83b2efc9f3a7921400c4d6560751e1c38682d`). PR #542 merged into dev at `eeb4d59`. The original plan requiring Deno filtering has been superseded by the independent architecture above.

The independent update is authorized by the user. Its production execution and deployment evidence are recorded in the product documentation; database readiness alone does not mean the Next.js release or production write acceptance is complete. Never roll back to code that treats the frozen legacy table as the current application source.

2026-11-02 independent update completed in production after a fresh pull and reviewed push: two old foreign keys removed, own sequence/default created, favorites now reference profiles. Imported 24 records with original IDs; historical full-row hash unchanged, 24 published profiles, sequence last value 25, RLS enabled, and post-update schema diff empty. No production test fixtures were created. A direct read through the new service returns all 24 original IDs with no private fields. Application deployment remains separate.
