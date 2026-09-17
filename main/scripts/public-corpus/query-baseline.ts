// Test-only snapshot of the previous direct SQL; never used by application code.
import { Prisma } from "@prisma/client";
import * as OpenCC from "opencc-js";
const simplified = OpenCC.Converter({ from: "hk", to: "cn" });
const traditional = OpenCC.Converter({ from: "cn", to: "hk" });

export function buildDirectBaseline(
  projection: Prisma.Sql,
  query: string,
  datasets: string[] | null,
  contentAttribute: string | null = null,
): Prisma.Sql {
  const prefixEnd = projection.sql.indexOf(", primary_match as (");
  const suffixStart = projection.sql.indexOf("\n      select\n        'primary'");
  if (prefixEnd < 0 || suffixStart < 0) throw new Error("Primary projection changed");
  const prefix = projection.sql.slice(0, prefixEnd);
  const suffix = projection.sql.slice(suffixStart);
  if (prefix.includes("?") || suffix.includes("?")) throw new Error("Unexpected bound projection");
  const terms = [...new Set([query.trim(), simplified(query.trim()), traditional(query.trim())].filter(Boolean))];
  if (!terms.length) return Prisma.sql`${Prisma.raw(prefix)}, primary_match as (select null::uuid as unique_id where false) ${Prisma.raw(suffix)}`;
  const exact = Prisma.sql`c.data in (${Prisma.join(terms)})`;
  const folded = Prisma.sql`lower(c.data) in (${Prisma.join(terms.map((term) => term.toLowerCase()))})`;
  const prefixes = terms.map((term) => Prisma.sql`c.data ilike ${`${term}%`}`);
  const contains = terms.map((term) => Prisma.sql`c.data ilike ${`%${term}%`}`);
  const fullText = terms.map((term) => Prisma.sql`c.data &@~ ${term}`);
  const scope = datasets === null ? Prisma.empty : datasets.length
    ? Prisma.sql`and c.category in (${Prisma.join(datasets)})` : Prisma.sql`and false`;
  const attribute = contentAttribute === null ? Prisma.empty : Prisma.sql`and exists (
    select 1 from cantonese_categories ds where ds.name = c.category and ds.content_attribute = ${contentAttribute}
  )`;
  return Prisma.sql`${Prisma.raw(prefix)}, primary_match as (
    select c.unique_id from public_corpus c
    where (${Prisma.join([exact, folded, ...prefixes, ...contains, ...fullText], " or ")}) ${scope} ${attribute}
    order by case when ${exact} then 0 when ${folded} then 1
      when (${Prisma.join(prefixes, " or ")}) then 2
      when (${Prisma.join(fullText, " or ")}) then 3 else 4 end,
      length(c.data), c.view_num desc, c.bookmark_num desc, c.liked_num desc
    limit 1
  ) ${Prisma.raw(suffix)}`;
}
