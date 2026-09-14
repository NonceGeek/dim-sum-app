import { PrismaClient } from "@prisma/client";

// Historical command name retained; only DATASET attributes are updated now.
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


async function main() {
  const rows = await prisma.cantonese_categories.findMany({
    where: { name: { in: [...oralSources, ...culturalSources] }, content_attribute: "unclassified" },
    select: { name: true, content_attribute: true },
  });
  console.log(JSON.stringify({ mode: shouldApply ? "apply" : "dry-run", pendingDatasets: rows }));
  if (!shouldApply) return;
  await prisma.$transaction([
    prisma.cantonese_categories.updateMany({ where: { name: { in: [...oralSources] }, content_attribute: "unclassified" }, data: { content_attribute: "oral" } }),
    prisma.cantonese_categories.updateMany({ where: { name: { in: [...culturalSources] }, content_attribute: "unclassified" }, data: { content_attribute: "cultural_knowledge" } }),
  ]);
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
