import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const shouldApply = process.argv.includes("--apply");

const oralSources = [
  "txyl1",
  "yywj2",
  "xzpq",
  "gfxm1",
  "gfxm2",
  "gfxm3",
  "gfxm4",
  "nz",
  "hml",
  "dsgl",
  "txyl",
  "wlxfbdl",
  "yyjq",
  "yycygsj",
  "yycygsj_test",
  "gfty",
  "yydsp",
  "dgfy",
  "ysxt",
  "yyqk",
  "yyxwsjj",
] as const;

const culturalSources = [
  "zyzdv2",
  "tssbs",
  "xwfs",
  "ycwb_photo_collection",
  "sshzlj",
] as const;

const retainedUnclassifiedSources = ["lnwm", "fsys", "dbl"] as const;
const mappedSources = [...oralSources, ...culturalSources];
const reviewedSources = [...mappedSources, ...retainedUnclassifiedSources];

type CountRow = { content_attribute: string; row_count: bigint };
type SourceCountRow = { category: string; row_count: bigint };
type MismatchRow = { mismatch_count: bigint };

const stringify = (value: unknown) =>
  JSON.stringify(value, (_, item) =>
    typeof item === "bigint" ? item.toString() : item,
  );

async function getCounts(client: Prisma.TransactionClient | PrismaClient) {
  return client.$queryRaw<CountRow[]>`
    select content_attribute, count(*)::bigint as row_count
    from public.cantonese_corpus_all
    group by content_attribute
    order by content_attribute
  `;
}

async function getStrictMismatchCount(
  client: Prisma.TransactionClient | PrismaClient,
) {
  const [row] = await client.$queryRaw<MismatchRow[]>`
    select count(*)::bigint as mismatch_count
    from public.cantonese_corpus_all
    where (category = any(${[...oralSources]}::text[]) and content_attribute <> 'oral')
       or (category = any(${[
         ...culturalSources,
       ]}::text[]) and content_attribute <> 'cultural_knowledge')
       or (category = any(${[
         ...retainedUnclassifiedSources,
       ]}::text[]) and content_attribute <> 'unclassified')
  `;
  return row?.mismatch_count ?? BigInt(0);
}

async function main() {
  const actualSources = await prisma.$queryRaw<SourceCountRow[]>`
    select category, count(*)::bigint as row_count
    from public.cantonese_corpus_all
    group by category
    order by category
  `;
  const unknownSources = actualSources.filter(
    (source) => !reviewedSources.includes(source.category as never),
  );
  const missingSources = reviewedSources.filter(
    (category) => !actualSources.some((source) => source.category === category),
  );
  const [mappingConflict] = await prisma.$queryRaw<MismatchRow[]>`
    select count(*)::bigint as mismatch_count
    from public.cantonese_corpus_all
    where (category = any(${[
      ...oralSources,
    ]}::text[]) and content_attribute not in ('unclassified', 'oral'))
       or (category = any(${[
         ...culturalSources,
       ]}::text[]) and content_attribute not in ('unclassified', 'cultural_knowledge'))
       or (category = any(${[
         ...retainedUnclassifiedSources,
       ]}::text[]) and content_attribute <> 'unclassified')
  `;

  const preview = {
    mode: shouldApply ? "apply" : "preview",
    version: "s6-content-attribute-source-v1",
    oral: actualSources
      .filter((source) => oralSources.includes(source.category as never))
      .reduce((sum, source) => sum + source.row_count, BigInt(0)),
    culturalKnowledge: actualSources
      .filter((source) => culturalSources.includes(source.category as never))
      .reduce((sum, source) => sum + source.row_count, BigInt(0)),
    retainedUnclassified: actualSources
      .filter((source) =>
        retainedUnclassifiedSources.includes(source.category as never),
      )
      .reduce((sum, source) => sum + source.row_count, BigInt(0)),
    unknownSources,
    missingSources,
    mappingConflictCount: mappingConflict?.mismatch_count ?? BigInt(0),
    strictMismatchCount: await getStrictMismatchCount(prisma),
    before: await getCounts(prisma),
  };
  console.log(stringify(preview));

  if (
    unknownSources.length > 0 ||
    missingSources.length > 0 ||
    (mappingConflict?.mismatch_count ?? BigInt(0)) > BigInt(0)
  ) {
    throw new Error("Source coverage check failed; no updates were applied.");
  }
  if (!shouldApply) return;

  const after = await prisma.$transaction(
    async (tx) => {
      await tx.cantonese_corpus_all.updateMany({
        where: {
          category: { in: [...oralSources] },
          content_attribute: "unclassified",
        },
        data: { content_attribute: "oral" },
      });
      await tx.cantonese_corpus_all.updateMany({
        where: {
          category: { in: [...culturalSources] },
          content_attribute: "unclassified",
        },
        data: { content_attribute: "cultural_knowledge" },
      });
      return getCounts(tx);
    },
    { maxWait: 10_000, timeout: 120_000 },
  );

  console.log(stringify({ after }));
  const strictMismatchCount = await getStrictMismatchCount(prisma);
  console.log(stringify({ strictMismatchCount }));

  const expected = new Map([
    ["oral", BigInt(41038)],
    ["cultural_knowledge", BigInt(9703)],
    ["unclassified", BigInt(253)],
  ]);
  const valid = after.every(
    (row) => expected.get(row.content_attribute) === row.row_count,
  );
  if (
    after.length !== expected.size ||
    !valid ||
    strictMismatchCount !== BigInt(0)
  ) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
