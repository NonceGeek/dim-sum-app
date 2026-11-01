import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPrimarySearchTerms } from "@/lib/search/search-terms";

export type SearchSuggestion = { id: string; data: string; category: string };

export function buildSuggestionsSql(query: string, datasets: string[] | null): Prisma.Sql {
  const terms = getPrimarySearchTerms(query);
  if (!terms.length) return Prisma.sql`select null::text as id, null::text as data, null::text as category where false`;
  // LIKE metacharacters in user input are literal characters, not wildcards.
  const escaped = terms.map((term) => term.replace(/[\\%_]/g, "\\$&"));
  const prefix = Prisma.join(escaped.map((term) => Prisma.sql`c.data ilike ${term + "%"}`), " or ");
  const contains = Prisma.join(escaped.map((term) => Prisma.sql`c.data ilike ${"%" + term + "%"}`), " or ");
  const scope = datasets === null ? Prisma.empty : datasets.length
    ? Prisma.sql`and c.category in (${Prisma.join(datasets)})`
    : Prisma.sql`and false`;

  return Prisma.sql`
    select c.id::text as id, c.data, c.category
    from public.cantonese_corpus_all c
    where exists (
      select 1 from public.cantonese_categories ds
      where ds.name = c.category and ds.is_public = true
    )
      ${scope}
      and (${contains})
    order by case
      when c.data in (${Prisma.join(terms)}) then 0
      when (${prefix}) then 1
      else 2 end,
      length(c.data), c.view_num desc, c.id asc
    limit 6
  `;
}

export async function fetchSearchSuggestions(query: string, datasets: string[] | null): Promise<SearchSuggestion[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '3000ms'");
    return tx.$queryRaw<SearchSuggestion[]>(buildSuggestionsSql(query, datasets));
  }, { maxWait: 2_000, timeout: 5_000 });
}
