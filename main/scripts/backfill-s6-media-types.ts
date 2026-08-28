import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const batchSize = 1_000;

type BatchRow = { id: bigint };
type CountRow = { count: bigint };

async function countMismatches() {
  const [row] = await prisma.$queryRaw<CountRow[]>`
    select count(*)::bigint as count
    from public.cantonese_corpus_all
    where media_types is distinct from
      public.derive_corpus_media_types(data, note, structured_note)
  `;
  return row?.count ?? BigInt(0);
}

async function main() {
  const initialMismatchCount = await countMismatches();
  console.log(`Initial mismatch count: ${initialMismatchCount}`);

  let processed = 0;

  while (true) {
    const rows = await prisma.$queryRaw<BatchRow[]>`
      with target as (
        select id
        from public.cantonese_corpus_all
        where media_types is distinct from
          public.derive_corpus_media_types(data, note, structured_note)
        order by id
        limit ${batchSize}
      )
      update public.cantonese_corpus_all corpus
      set media_types = public.derive_corpus_media_types(
        corpus.data,
        corpus.note,
        corpus.structured_note
      )
      from target
      where corpus.id = target.id
      returning corpus.id
    `;

    if (rows.length === 0) break;

    processed += rows.length;
    const lastId = rows.reduce(
      (maximum, row) => (row.id > maximum ? row.id : maximum),
      BigInt(0),
    );
    console.log(
      `Backfilled ${processed}/${initialMismatchCount} rows; last batch max id=${lastId}`,
    );
  }

  const finalMismatchCount = await countMismatches();
  console.log(
    `Backfill complete: processed=${processed}, remaining mismatches=${finalMismatchCount}`,
  );

  if (finalMismatchCount !== BigInt(0)) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
