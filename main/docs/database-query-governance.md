# Database query governance

## Production baseline

The runtime `DATABASE_URL` must use the Supabase transaction pooler in the same
region as the Vercel Functions. Start with:

```text
?pgbouncer=true&connection_limit=3&pool_timeout=5
```

`connection_limit` applies to every warm serverless function instance. Raise it
only after checking Supabase connection metrics. Raising `pool_timeout` alone
does not solve contention; it only makes users wait longer.

## Query rules

- Keep one shared `PrismaClient` per warm runtime. Never construct a client in a
  route or disconnect it after a request.
- Use `prisma.$transaction([list, count])` for pagination pairs. This preserves a
  consistent result and prevents one request from acquiring two pool slots.
- Combine several counts over the same table with `groupBy` or filtered SQL
  aggregates instead of issuing one query per status.
- Limit intentional database concurrency in a request to three operations. A
  larger fan-out must be grouped, serialized, or moved into one query.
- Public, non-personalized read endpoints should send a short CDN cache policy.
- A Prisma `P2024` is a temporary capacity failure. Return `503`, include
  `Retry-After`, and do not run another database fallback while the pool is busy.
- Add an index only after checking the production query shape and execution
  plan. Vector search uses the existing partial HNSW indexes.

## Audit summary (2026-08-27)

- About 80 application files access Prisma directly.
- Pagination list/count pairs were consolidated onto one transaction connection.
- Corpus collection profile statistics were reduced from six queries to three.
- Corpus collection analytics summary was reduced from eight queries to four.
- Initial entry semantic search now returns similar and recommended results from
  one SQL execution. Pagination queries request only their required section.
- Semantic search no longer performs three correlated dynamic-vector scans for
  recommended results. It reuses the primary corpus id, enforces an 8-second
  statement timeout, and will restore full neighbor expansion from an offline
  precomputed neighbor table.
- Semantic search no longer starts a second fallback query after a `P2024`.
- Public corpus collection home/activity lists and entry search use short CDN
  caches to absorb repeated reads.
- Production index statistics show the document-vector HNSW index is in use.
  Activity and submission tables are currently small enough that sequential
  scans are cheaper than additional indexes, so this pass adds no speculative
  indexes.

Planner row estimates for the two large search tables remain reasonably close
to their observed sizes, although `last_analyze` is not available in the
current statistics view. Recheck plans after major imports and run database
maintenance through the normal Supabase process rather than from an API route.

The remaining `Promise.all` database calls are intentional and bounded:

- entry primary and semantic search: two independent progressive sections;
- corpus collection home: three independent result groups, matching the pool
  baseline after each pagination pair was placed in a one-connection transaction;
- questionnaire entry: two independent identity/activity validations;
- questionnaire insights: three administrator-only datasets.

## Operational verification

After changing `DATABASE_URL`, redeploy and verify:

1. Vercel Function execution region is `sin1`.
2. P2024 count and 5/10-second latency spikes decline.
3. Supabase active connections remain below the project limit.
4. Search, activity list, home, login, and questionnaire latency are checked
   under concurrent requests, not only one request at a time.
