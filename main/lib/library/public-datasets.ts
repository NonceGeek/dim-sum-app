import { prisma } from "@/lib/prisma";
import {
  DATASET_ACCESS_MODES,
  DATASET_MODALITIES,
  DATASET_QUALITY_FLAGS,
  DATASET_SORTS,
  DATASET_USE_CASES,
  DatasetAccessMode,
  DatasetModality,
  DatasetQualityFlag,
  DatasetSort,
  DatasetUseCase,
} from "./options";

/** The only shape that may leave the server for public Library pages. */
export type PublicDataset = {
  slug: string;
  zhName: string;
  enName: string | null;
  description: string | null;
  coverImageUrl: string | null;
  tags: string[];
  modalities: DatasetModality[];
  useCases: DatasetUseCase[];
  accessMode: DatasetAccessMode;
  scaleSummary: string | null;
  languageScope: string | null;
  sourceUrl: string | null;
  statusFlags: Array<"official" | "featured" | "verified" | "new" | "updated">;
  usageNotes: string | null;
  updatedAt: string;
};

export type PublicDatasetQuery = {
  q?: string;
  modalities?: DatasetModality[];
  useCases?: DatasetUseCase[];
  accessModes?: DatasetAccessMode[];
  qualityFlags?: DatasetQualityFlag[];
  sort?: DatasetSort;
  page?: number;
  pageSize?: number;
};

const RECENT_MS = 30 * 24 * 60 * 60 * 1000;

function pick<T extends string>(values: readonly T[], input: unknown): T[] {
  if (!Array.isArray(input)) return [];
  return input.filter((v): v is T => values.includes(v as T));
}

function list(params: URLSearchParams, key: string) {
  return params
    .getAll(key)
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean);
}

export function parsePublicDatasetQuery(
  params: URLSearchParams,
): PublicDatasetQuery {
  const sort = params.get("sort");
  const page = Number(params.get("page") ?? 1);
  const pageSize = Number(params.get("page_size") ?? 24);
  return {
    q: (params.get("q") ?? "").trim().slice(0, 100) || undefined,
    modalities: pick(DATASET_MODALITIES, list(params, "modalities")),
    useCases: pick(DATASET_USE_CASES, list(params, "use_cases")),
    accessModes: pick(DATASET_ACCESS_MODES, list(params, "access_modes")),
    qualityFlags: pick(DATASET_QUALITY_FLAGS, list(params, "quality_flags")),
    sort: DATASET_SORTS.includes(sort as DatasetSort)
      ? (sort as DatasetSort)
      : "relevance",
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize:
      Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 24,
  };
}

function safeUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

type Row = Awaited<ReturnType<typeof loadListedRows>>[number];

async function loadListedRows(slug?: string) {
  return prisma.library_dataset_profiles.findMany({
    where: { listed: true, ...(slug ? { dataset_name: slug } : {}) },
    select: {
      dataset_name: true,
      en_name: true,
      modalities: true,
      use_cases: true,
      access_mode: true,
      is_official: true,
      metadata_verified: true,
      scale_summary: true,
      language_scope: true,
      usage_notes: true,
      dataset: {
        select: {
          nickname: true,
          description: true,
          cover: true,
          link: true,
          tags: true,
          pinned: true,
          sorting: true,
          created_at: true,
          updated_at: true,
        },
      },
    },
  });
}

function toPublic(row: Row, now = Date.now()): PublicDataset & {
  _pinned: boolean;
  _sorting: number;
} {
  const d = row.dataset;
  // Dataset content time, not the Library profile row (backfills would mark everything updated).
  const updatedAt = d.updated_at ?? d.created_at;
  const flags: PublicDataset["statusFlags"] = [];
  if (row.is_official) flags.push("official");
  if (d.pinned) flags.push("featured");
  if (row.metadata_verified) flags.push("verified");
  if (now - d.created_at.getTime() < RECENT_MS) flags.push("new");
  else if (now - updatedAt.getTime() < RECENT_MS) flags.push("updated");
  return {
    slug: row.dataset_name,
    zhName: d.nickname || row.dataset_name,
    enName: row.en_name,
    description: d.description,
    coverImageUrl: safeUrl(d.cover),
    tags: Array.isArray(d.tags)
      ? d.tags.filter((t): t is string => typeof t === "string")
      : [],
    modalities: pick(DATASET_MODALITIES, row.modalities),
    useCases: pick(DATASET_USE_CASES, row.use_cases),
    accessMode: DATASET_ACCESS_MODES.includes(
      row.access_mode as DatasetAccessMode,
    )
      ? (row.access_mode as DatasetAccessMode)
      : "metadata_only",
    scaleSummary: row.scale_summary,
    languageScope: row.language_scope,
    sourceUrl: safeUrl(d.link),
    statusFlags: flags,
    usageNotes: row.usage_notes,
    updatedAt: updatedAt.toISOString(),
    _pinned: d.pinned,
    _sorting: Number(d.sorting),
  };
}

function strip<T extends { _pinned: boolean; _sorting: number }>(
  value: T,
): Omit<T, "_pinned" | "_sorting"> {
  const { _pinned, _sorting, ...rest } = value;
  return rest;
}

function relevance(item: PublicDataset, q: string) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  let score = 0;
  for (const term of terms) {
    const name = `${item.zhName} ${item.enName ?? ""} ${item.slug}`.toLowerCase();
    const tags = item.tags.join(" ").toLowerCase();
    const body = `${item.description ?? ""} ${item.modalities.join(" ")} ${item.useCases.join(" ")}`.toLowerCase();
    if (name.includes(term)) score += 3;
    else if (tags.includes(term)) score += 2;
    else if (body.includes(term)) score += 1;
    else return 0; // every term must match somewhere
  }
  return score;
}

export function filterAndSort(
  items: ReturnType<typeof toPublic>[],
  query: PublicDatasetQuery,
) {
  const any = <T>(wanted: T[] | undefined, has: (v: T) => boolean) =>
    !wanted?.length || wanted.some(has);
  let rows = items
    .filter(
      (d) =>
        any(query.modalities, (m) => d.modalities.includes(m)) &&
        any(query.useCases, (u) => d.useCases.includes(u)) &&
        any(query.accessModes, (a) => d.accessMode === a) &&
        // Quality flags are independent attributes, so every selected flag must hold.
        (query.qualityFlags ?? []).every((f) => d.statusFlags.includes(f)),
    )
    .map((d) => ({ d, score: query.q ? relevance(d, query.q) : 1 }))
    .filter(({ score }) => score > 0);
  rows.sort((a, b) => {
    if (query.sort === "newest")
      return b.d.updatedAt.localeCompare(a.d.updatedAt);
    return (
      b.score - a.score ||
      Number(b.d._pinned) - Number(a.d._pinned) ||
      a.d._sorting - b.d._sorting ||
      a.d.zhName.localeCompare(b.d.zhName)
    );
  });
  return rows.map(({ d }) => d);
}

export async function listPublicDatasets(query: PublicDatasetQuery) {
  const rows = (await loadListedRows()).map((r) => toPublic(r));
  const sorted = filterAndSort(rows, query);
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 24;
  return {
    items: sorted.slice((page - 1) * pageSize, page * pageSize).map(strip),
    total: sorted.length,
    page,
    pageSize,
  };
}

export async function getPublicDataset(
  slug: string,
): Promise<PublicDataset | null> {
  if (!slug || slug.length > 200) return null;
  const [row] = await loadListedRows(slug);
  return row ? strip(toPublic(row)) : null;
}

export async function listPublicDatasetSlugs() {
  const rows = await prisma.library_dataset_profiles.findMany({
    where: { listed: true },
    select: { dataset_name: true, updated_at: true },
  });
  return rows.map((r) => ({ slug: r.dataset_name, updatedAt: r.updated_at }));
}
