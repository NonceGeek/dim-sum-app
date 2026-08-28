import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type AuditRow = {
  total: bigint;
  bad_content_attribute_count: bigint;
  empty_media_types_count: bigint;
  bad_media_types_count: bigint;
  media_derivation_mismatch_count: bigint;
};

type CombinationRow = { media_types: string[]; row_count: bigint };
type ShipRow = {
  id: bigint;
  unique_id: string;
  data: string;
  media_types: string[];
};
type ConstraintRow = { conname: string; convalidated: boolean };

const stringify = (value: unknown) =>
  JSON.stringify(value, (_, item) =>
    typeof item === "bigint" ? item.toString() : item,
  );

async function main() {
  const [audit] = await prisma.$queryRaw<AuditRow[]>`
    select
      count(*)::bigint as total,
      count(*) filter (
        where content_attribute not in ('unclassified', 'oral', 'cultural_knowledge')
      )::bigint as bad_content_attribute_count,
      count(*) filter (
        where cardinality(media_types) = 0 or media_types is null
      )::bigint as empty_media_types_count,
      count(*) filter (
        where not media_types <@ array['text', 'audio', 'video', 'image', 'model3d']::text[]
           or media_types[1] is distinct from 'text'
      )::bigint as bad_media_types_count,
      count(*) filter (
        where media_types is distinct from
          public.derive_corpus_media_types(data, note, structured_note)
      )::bigint as media_derivation_mismatch_count
    from public.cantonese_corpus_all
  `;
  const combinations = await prisma.$queryRaw<CombinationRow[]>`
    select media_types, count(*)::bigint as row_count
    from public.cantonese_corpus_all
    group by media_types
    order by row_count desc, media_types
  `;
  const ship = await prisma.$queryRaw<ShipRow[]>`
    select id, unique_id, data, media_types
    from public.cantonese_corpus_all
    where unique_id = '9fb359b2-f561-4264-8e5e-ec899fb0cab1'::uuid
  `;
  const constraints = await prisma.$queryRaw<ConstraintRow[]>`
    select conname, convalidated
    from pg_constraint
    where conrelid = 'public.cantonese_corpus_all'::regclass
      and conname in ('corpus_content_attribute_ck', 'corpus_media_types_ck')
    order by conname
  `;

  console.log(stringify({ audit, combinations, ship, constraints }));

  const failed =
    !audit ||
    audit.bad_content_attribute_count !== BigInt(0) ||
    audit.empty_media_types_count !== BigInt(0) ||
    audit.bad_media_types_count !== BigInt(0) ||
    audit.media_derivation_mismatch_count !== BigInt(0) ||
    ship.length !== 1 ||
    ship[0].media_types.join(",") !== "text,audio,model3d" ||
    constraints.length !== 2 ||
    constraints.some((constraint) => !constraint.convalidated);

  if (failed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
