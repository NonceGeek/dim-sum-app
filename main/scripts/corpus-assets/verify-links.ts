/**
 * Read-only check for #509: media extracted by linksCte must agree with the
 * media_types derived column for every entry. Exits non-zero on any mismatch.
 *   node --import tsx scripts/corpus-assets/verify-links.ts
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { Prisma } = await import("@prisma/client");
  const { prisma } = await import("@/lib/prisma");
  const { linksCte, ASSET_MEDIA_TYPES } = await import("@/lib/analytics/corpus-assets");
  for (const kind of ASSET_MEDIA_TYPES) {
    const [row] = await prisma.$queryRaw<Array<{ derived: number; extracted: number; mismatched: number; urls: number }>>`
      WITH ${linksCte()},
      x AS (SELECT DISTINCT corpus_id FROM links WHERE kind = ${kind}),
      d AS (SELECT id FROM cantonese_corpus_all WHERE ${kind} = ANY(media_types))
      SELECT (SELECT count(*) FROM d)::int AS derived,
             (SELECT count(*) FROM x)::int AS extracted,
             (SELECT count(*) FROM (SELECT id FROM d EXCEPT SELECT corpus_id FROM x UNION ALL (SELECT corpus_id FROM x EXCEPT SELECT id FROM d)) m)::int AS mismatched,
             (SELECT count(DISTINCT url) FROM links WHERE kind = ${kind})::int AS urls`;
    console.log(kind, row);
    if (row.mismatched) process.exitCode = 1;
  }
  const shared = await prisma.$queryRaw<Array<{ shared_urls: number; max_entries: number }>>`
    WITH ${linksCte()}
    SELECT count(*)::int AS shared_urls, coalesce(max(n), 0)::int AS max_entries
    FROM (SELECT url, count(DISTINCT category) AS n FROM links GROUP BY url HAVING count(DISTINCT category) > 1) s`;
  console.log("urls shared across datasets", shared[0]);
  void Prisma;
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
