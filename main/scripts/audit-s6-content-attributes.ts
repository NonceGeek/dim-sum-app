import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SummaryRow = {
  total_rows: bigint;
  source_count: bigint;
  missing_source_count: bigint;
  unclassified_count: bigint;
};

type SourceRow = {
  source_category: string;
  source_name: string | null;
  description: string | null;
  source_status: string | null;
  is_public: boolean | null;
  row_count: bigint;
  normalized_count: bigint;
  draft_count: bigint;
  text_only_count: bigint;
  audio_count: bigint;
  video_count: bigint;
  image_count: bigint;
  model3d_count: bigint;
  average_text_length: number | null;
  sample_entries: string[];
};

const stringify = (value: unknown) =>
  JSON.stringify(value, (_, item) =>
    typeof item === "bigint" ? item.toString() : item,
  );

async function main() {
  const [summary] = await prisma.$queryRaw<SummaryRow[]>`
    select
      count(*)::bigint as total_rows,
      count(distinct corpus.category)::bigint as source_count,
      count(*) filter (where source.name is null)::bigint as missing_source_count,
      count(*) filter (where corpus.content_attribute = 'unclassified')::bigint
        as unclassified_count
    from public.cantonese_corpus_all corpus
    left join public.cantonese_categories source
      on source.name = corpus.category
  `;

  const sources = await prisma.$queryRaw<SourceRow[]>`
    select
      corpus.category as source_category,
      max(source.nickname) as source_name,
      max(source.description) as description,
      max(source.status::text) as source_status,
      bool_or(source.is_public) as is_public,
      count(*)::bigint as row_count,
      count(*) filter (where corpus.lifecycle_stage = 'normalized')::bigint
        as normalized_count,
      count(*) filter (where corpus.lifecycle_stage = 'draft')::bigint
        as draft_count,
      count(*) filter (where corpus.media_types = array['text']::text[])::bigint
        as text_only_count,
      count(*) filter (where corpus.media_types @> array['audio']::text[])::bigint
        as audio_count,
      count(*) filter (where corpus.media_types @> array['video']::text[])::bigint
        as video_count,
      count(*) filter (where corpus.media_types @> array['image']::text[])::bigint
        as image_count,
      count(*) filter (where corpus.media_types @> array['model3d']::text[])::bigint
        as model3d_count,
      round(avg(length(corpus.data))::numeric, 1)::float8 as average_text_length,
      (
        select array_agg(sample.data order by sample.id)
        from (
          select item.id, left(item.data, 160) as data
          from public.cantonese_corpus_all item
          where item.category = corpus.category
          order by item.id
          limit 5
        ) sample
      ) as sample_entries
    from public.cantonese_corpus_all corpus
    left join public.cantonese_categories source
      on source.name = corpus.category
    group by corpus.category
    order by count(*) desc, corpus.category
  `;

  console.log(stringify({ summary, sources }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
