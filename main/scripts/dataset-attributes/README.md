# Dataset attribute migration

See [business rules and release order](../../../docs/search-platform/s6-dimsum-search-system-upgrade-3.0/13-dataset-content-attribute-implementation.md).

2026-09-13 execution: the user explicitly authorized pull followed by push and immediate removal of the old column. Production migration is complete: pull → `01-expand-and-backfill.sql` → reviewed target schema → `prisma db push --accept-data-loss` → pull with an empty target diff. `02-contract.sql` was not needed. The application has not been deployed; old code that reads the removed column must be replaced. The staged guidance below describes the original rollout plan.

- `01-expand-and-backfill.sql`: additive schema and conservative source migration; old applications can still run. New activity datasets remain private and unclassified until configured.
- `02-contract.sql`: run only after deploying the new application and retiring old writers. Makes activity.dataset_name required and removes the entry attribute without CASCADE.
- Do not execute a destructive db push against the final Prisma schema before the application cutover.
- Use the selected environment's existing secure database connection tooling to execute the SQL. Do not put connection strings in logs or source files.

## Isolated tests

Create a fresh local database whose name begins with `dimsum_dataset_test`. Never use test-fixture.sql against an existing application database.

From `main`, with local PostgreSQL on port 55438:

```sh
createdb -h 127.0.0.1 -p 55438 dimsum_dataset_test
psql -h 127.0.0.1 -p 55438 -d dimsum_dataset_test -v ON_ERROR_STOP=1 -f scripts/dataset-attributes/test-fixture.sql
psql -h 127.0.0.1 -p 55438 -d dimsum_dataset_test -v ON_ERROR_STOP=1 -f scripts/dataset-attributes/01-expand-and-backfill.sql
DATASET_TEST_DATABASE_URL=postgresql://127.0.0.1:55438/dimsum_dataset_test node --import tsx scripts/dataset-attributes/integration-test.ts
psql -h 127.0.0.1 -p 55438 -d dimsum_dataset_test -v ON_ERROR_STOP=1 -f scripts/dataset-attributes/02-contract.sql
```

The integration script rejects non-local hosts and other database names. Rerun the fixture in a fresh database for another full test; the test modifies its fixture records.
