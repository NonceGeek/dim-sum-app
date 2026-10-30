import { Prisma } from "@prisma/client";
import * as OpenCC from "opencc-js";
import { prisma } from "@/lib/prisma";
import { decodeCursor, encodeCursor } from "./contracts";
import { formatEntry, type SearchRow } from "./content";
const simplified = OpenCC.Converter({ from: "hk", to: "cn" });
const traditional = OpenCC.Converter({ from: "cn", to: "hk" });
export const queryTerms = (q: string) => [
  ...new Set([q, simplified(q), traditional(q)]),
];
// Literal strpos matching avoids text-index LIKE false negatives; eligibility is still applied before the page limit.
const or = (items: Prisma.Sql[]) => Prisma.sql`(${Prisma.join(items, " OR ")})`;
const block = (type: string, matching = false) =>
  Prisma.sql`(SELECT nullif(btrim(b.value->>'content'),'') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(c.structured_note->'data')='array' THEN c.structured_note->'data' ELSE '[]'::jsonb END) WITH ORDINALITY d(value,n) CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(d.value->'blocks')='array' THEN d.value->'blocks' ELSE '[]'::jsonb END) WITH ORDINALITY b(value,n) WHERE b.value->>'type'=${type} AND jsonb_typeof(b.value->'content')='string' AND nullif(btrim(b.value->>'content'),'') IS NOT NULL ${matching ? Prisma.sql`AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(d.value->'blocks') s WHERE s->>'type'='sentence' AND jsonb_typeof(s->'content')='string' AND btrim(regexp_replace(s->>'content','__[0-9]{6}_[0-9a-f]{8}$','','i'))<>c.expression)` : Prisma.empty} ORDER BY d.n,b.n LIMIT 1)`;
const expression = Prisma.sql`btrim(regexp_replace(coalesce(${block("sentence")},c.data),'__[0-9]{6}_[0-9a-f]{8}$','','i'))`;
const meaning = Prisma.sql`coalesce(${block("definition", true)}, ${Prisma.join(["meaning", "definition", "translation", "普通话翻译", "中文翻译", "释义", "意思"].map((key) => Prisma.sql`CASE WHEN jsonb_typeof(c.note->'context'->${key})='string' THEN nullif(btrim(c.note->'context'->>${key}),'') END`))})`;
export function eligibleSql(
  condition: Prisma.Sql,
  expressionCondition: Prisma.Sql = Prisma.sql`true`,
) {
  // Materialize the public scope before parsing JSON. Otherwise PostgreSQL can
  // evaluate correlated expression subqueries on every corpus row (and once
  // per query variant) before applying the dataset join.
  return Prisma.sql`WITH public_rows AS MATERIALIZED (
    SELECT c.id,c.unique_id::text,c.data,c.note,c.structured_note,
      c.category AS dataset_name,d.id AS dataset_id,d.nickname AS dataset_label
    FROM cantonese_corpus_all c
    JOIN cantonese_categories d ON d.name=c.category
    WHERE d.is_public=true AND d.content_attribute='oral' AND ${condition}
  ), candidate AS MATERIALIZED (
    SELECT c.*,${expression} AS expression FROM public_rows c
  ), matched AS MATERIALIZED (
    SELECT * FROM candidate c WHERE expression<>'' AND ${expressionCondition}
  ), qualified AS MATERIALIZED (
    SELECT c.*,${meaning} AS meaning FROM matched c
  ) SELECT c.*,ARRAY(
    SELECT l.name FROM dataset_licences l
    WHERE l.cantonese_categories_id=c.dataset_id
      AND nullif(btrim(l.name),'') IS NOT NULL ORDER BY l.id LIMIT 5
  ) AS licenses FROM qualified c WHERE meaning IS NOT NULL`;
}
export function searchSql(
  query: string,
  limit: number,
  cursor: ReturnType<typeof decodeCursor>,
) {
  const terms = queryTerms(query);
  // Native JSONPath is a cheap candidate filter, not the final expression
  // match. Quoted regex treats user input (including brackets/%/backslashes)
  // literally; the path itself is still a bound SQL parameter.
  const candidates = or(terms.map((term) => {
    const path = `$.data[*].blocks[*] ? (@.type == "sentence" && @.content.type() == "string" && @.content like_regex ${JSON.stringify(term)} flag "iq")`;
    return Prisma.sql`strpos(lower(c.data),lower(${term}))>0 OR jsonb_path_exists(c.structured_note,${path}::jsonpath)`;
  }));
  const base = eligibleSql(
    candidates,
    or(terms.map((term) => Prisma.sql`strpos(lower(expression),lower(${term}))>0`)),
  );
  return Prisma.sql`WITH eligible AS (${base}), ranked AS (SELECT *,CASE WHEN lower(expression) IN (${Prisma.join(terms.map((t) => t.toLowerCase()))}) THEN 0 ELSE 1 END AS rank FROM eligible) SELECT * FROM ranked ${cursor ? Prisma.sql`WHERE (rank,id)>(${cursor.rank},${cursor.id})` : Prisma.empty} ORDER BY rank,id LIMIT ${limit + 1}`;
}
export async function searchEntries(
  query: string,
  limit: number,
  cursor: ReturnType<typeof decodeCursor>,
) {
  const rows = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '5000ms'`;
      // Short interactive searches should not pay JIT compilation cost for JSON subplans.
      await tx.$executeRaw`SET LOCAL jit = off`;
      return tx.$queryRaw<SearchRow[]>(searchSql(query, limit, cursor));
    },
    { maxWait: 10000, timeout: 12000 },
  );
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    direct: page.filter((r) => r.rank === 0).map(formatEntry),
    related: page.filter((r) => r.rank !== 0).map(formatEntry),
    nextCursor:
      rows.length > limit && last
        ? encodeCursor(query, last.rank ?? 1, last.id)
        : null,
  };
}
export async function getEntry(
  id: string,
  db: Pick<typeof prisma, "$queryRaw"> = prisma,
) {
  const rows = await db.$queryRaw<SearchRow[]>(
    eligibleSql(Prisma.sql`c.unique_id=${id}::uuid`),
  );
  return rows[0] ? formatEntry(rows[0]) : null;
}
