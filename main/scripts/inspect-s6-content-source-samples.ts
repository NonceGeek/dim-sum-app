import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const sourceKeys = [
  "lnwm",
  "fsys",
  "dbl",
  "yycygsj",
  "yycygsj_test",
  "tssbs",
  "xwfs",
  "gfty",
  "yydsp",
  "ysxt",
  "yyxwsjj",
  "yyjq",
  "yyqk",
  "sshzlj",
];

type SampleRow = {
  source_category: string;
  corpus_id: bigint;
  entry_name: string;
  note_preview: string | null;
  structured_note_preview: string | null;
  primary_category: string | null;
  secondary_category: string | null;
};

const stringify = (value: unknown) =>
  JSON.stringify(value, (_, item) =>
    typeof item === "bigint" ? item.toString() : item,
  );

async function main() {
  const samples = await prisma.$queryRaw<SampleRow[]>`
    with ranked as (
      select
        corpus.*,
        row_number() over (partition by corpus.category order by corpus.id) as sample_rank
      from public.cantonese_corpus_all corpus
      where corpus.category = any(${sourceKeys}::text[])
    )
    select
      ranked.category as source_category,
      ranked.id as corpus_id,
      left(ranked.data, 240) as entry_name,
      left(ranked.note::text, 800) as note_preview,
      left(ranked.structured_note::text, 1200) as structured_note_preview,
      parent.name as primary_category,
      child.name as secondary_category
    from ranked
    left join public.corpus_category assignment
      on assignment.corpus_id = ranked.id
    left join public.content_categories child
      on child.id = assignment.category_id
    left join public.content_categories parent
      on parent.id = child.parent_id
    where ranked.sample_rank <= 3
    order by ranked.category, ranked.sample_rank
  `;

  console.log(stringify(samples));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
