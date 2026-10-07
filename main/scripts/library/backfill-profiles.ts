/**
 * One-off backfill of Library profiles from existing datasets (#453).
 *   npx tsx scripts/library/backfill-profiles.ts          # dry run, prints the plan
 *   npx tsx scripts/library/backfill-profiles.ts --apply  # writes missing profiles only
 * Existing profiles are never modified; operators refine values in admin → 语料集管理.
 */
import { prisma } from "../../lib/prisma";
import {
  DatasetAccessMode,
  DatasetModality,
  DatasetUseCase,
} from "../../lib/library/options";

const MODALITY_TAGS: Record<string, Exclude<DatasetModality, "multimodal">> = {
  文本: "text",
  问答对: "text",
  词典: "text",
  音频: "audio",
  视频: "image_video",
  图片: "image_video",
  图像: "image_video",
};
const USE_CASE_TAGS: Record<string, DatasetUseCase> = {
  模型训练: "training",
  大模型: "training",
  安全: "safety_eval",
  文化: "culture_research",
  传统文化: "culture_research",
  经典: "culture_research",
};

export function inferProfile(category: { tags: unknown; link: string | null }) {
  const tags = Array.isArray(category.tags)
    ? category.tags.filter((t): t is string => typeof t === "string")
    : [];
  const media = [...new Set(tags.map((t) => MODALITY_TAGS[t]).filter(Boolean))];
  const modalities: DatasetModality[] =
    media.length > 1 ? [...media, "multimodal"] : media;
  const useCases = [
    ...new Set(tags.map((t) => USE_CASE_TAGS[t]).filter(Boolean)),
  ] as DatasetUseCase[];
  const accessMode: DatasetAccessMode = category.link ? "external" : "metadata_only";
  return { modalities, useCases, accessMode };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const categories = await prisma.cantonese_categories.findMany({
    where: {
      is_public: true,
      NOT: { name: { startsWith: "activity-" } },
      libraryProfile: null,
    },
    select: { name: true, nickname: true, tags: true, link: true },
    orderBy: [{ pinned: "desc" }, { sorting: "asc" }],
  });
  const plan = categories.map((c) => ({ name: c.name, nickname: c.nickname, ...inferProfile(c) }));
  console.table(
    plan.map((p) => ({
      name: p.name,
      nickname: p.nickname,
      modalities: p.modalities.join(","),
      useCases: p.useCases.join(","),
      accessMode: p.accessMode,
    })),
  );
  console.log(`${plan.length} profiles to create (listed=true).`);
  if (!apply) {
    console.log("Dry run only. Re-run with --apply to write.");
    return;
  }
  const result = await prisma.library_dataset_profiles.createMany({
    data: plan.map((p) => ({
      dataset_name: p.name,
      listed: true,
      modalities: p.modalities,
      use_cases: p.useCases,
      access_mode: p.accessMode,
      updated_by: "backfill-453",
    })),
    skipDuplicates: true,
  });
  console.log(`Created ${result.count} profiles.`);
}

if (process.argv[1]?.endsWith("backfill-profiles.ts"))
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
