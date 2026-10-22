import type { DateRange } from "@/lib/analytics/dashboard";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";

/**
 * Corpus asset inventory (#509). Current stock only — no visits, searches or plays.
 *
 * - Every row of cantonese_corpus_all counts as ingested (draft rows are a legacy
 *   processing stage, not unpublished drafts); deleted rows are simply gone.
 * - Media are extracted from note / structured_note with the same keys as the
 *   media_types derivation, and deduplicated by URL (the only resource id that exists).
 *   Only http(s) values count: e.g. note.context.普通话 mostly holds a Mandarin
 *   translation, not an audio link.
 * - Size and duration come from corpus_media_assets (filled by the probe script);
 *   anything not probed yet is reported as missing, never as 0.
 */
export const CORPUS_ASSETS_TAG = "corpus-assets";
const TZ = "Asia/Shanghai";

export const ASSET_MEDIA_TYPES = ["audio", "video", "image", "model3d"] as const;
export type AssetMediaType = (typeof ASSET_MEDIA_TYPES)[number];

/** Legacy note.context keys, mirroring public.derive_corpus_media_types. */
export const LEGACY_MEDIA_KEY_PATTERNS: Record<AssetMediaType, string> = {
  audio: "^(audio|audioUrl|音频[0-9]*|音频链接|粤语|普通话)$",
  video: "^(video|videoUrl|视频|视频链接|video_clips)$",
  image: "^(img|image|imageUrl|cover|coverImage|photo_url|图片|封面|封面图)$",
  model3d: "^(voxel|model3d|model_3d|3d_model|gltf|glb|usdz)$",
};

/** A summed measure plus how many resources still lack the value. */
export type Measure = { value: number; missing: number };
export type MediaStat = { count: number; duration: Measure; size: Measure };

export type AssetDatasetRow = {
  name: string;
  id: number;
  nickname: string | null;
  contentAttribute: string;
  isPublic: boolean;
  entries: number;
  textEntries: number;
  media: Record<AssetMediaType, MediaStat>;
  size: Measure;
  lastIngestedAt: string | null;
};

export type AssetOverview = {
  datasets: number;
  publicDatasets: number;
  privateDatasets: number;
  entries: number;
  media: Record<AssetMediaType, MediaStat>;
  size: Measure;
  resources: number;
  probedResources: number;
  computedAt: string;
};

/* ---------- SQL building blocks ---------- */

const urlOf = (v: Prisma.Sql) => Prisma.sql`coalesce(nullif(btrim(${v}->>'url'), ''), nullif(btrim(${v}->>'link'), ''))`;

/** All URLs inside a JSON value that may be a string, {url|link} object, or array of those. */
const urlsIn = (v: Prisma.Sql) => Prisma.sql`(
  SELECT nullif(btrim(${v} #>> '{}'), '') AS url WHERE jsonb_typeof(${v}) = 'string'
  UNION ALL SELECT ${urlOf(v)} WHERE jsonb_typeof(${v}) = 'object'
  UNION ALL SELECT CASE jsonb_typeof(i) WHEN 'string' THEN nullif(btrim(i #>> '{}'), '') WHEN 'object' THEN ${urlOf(Prisma.sql`i`)} END
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(${v}) = 'array' THEN ${v} ELSE '[]'::jsonb END) i
)`;

const legacyKind = Prisma.sql`CASE
  WHEN kv.key ~* ${LEGACY_MEDIA_KEY_PATTERNS.audio} THEN 'audio'
  WHEN kv.key ~* ${LEGACY_MEDIA_KEY_PATTERNS.video} THEN 'video'
  WHEN kv.key ~* ${LEGACY_MEDIA_KEY_PATTERNS.image} THEN 'image'
  WHEN kv.key ~* ${LEGACY_MEDIA_KEY_PATTERNS.model3d} THEN 'model3d'
END`;

/**
 * CTE `links(corpus_id, category, created_at, kind, url)`: one row per distinct
 * entry × resource. `where` narrows the scanned entries (e.g. one dataset).
 * MATERIALIZED: when inlined into a single-reference query the planner picks a
 * plan that hits the statement timeout on production data.
 */
export function linksCte(where: Prisma.Sql = Prisma.sql`TRUE`) {
  return Prisma.sql`
    entries AS MATERIALIZED (
      SELECT id, category, created_at, note, structured_note
      FROM cantonese_corpus_all c WHERE ${where}
    ),
    raw_links AS MATERIALIZED (
      SELECT e.id AS corpus_id, CASE WHEN lower(b.block->>'type') = 'voxel' THEN 'model3d' ELSE lower(b.block->>'type') END AS kind,
             ${urlOf(Prisma.sql`b.block`)} AS url
      FROM entries e
      CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(e.structured_note->'data') = 'array' THEN e.structured_note->'data' ELSE '[]'::jsonb END) d(item)
      CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(d.item->'blocks') = 'array' THEN d.item->'blocks' ELSE '[]'::jsonb END) b(block)
      WHERE lower(b.block->>'type') IN ('audio', 'video', 'image', 'model3d', 'voxel')
      UNION ALL
      SELECT e.id, ${legacyKind}, u.url
      FROM entries e
      CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(e.note->'context') = 'object' THEN e.note->'context' ELSE '{}'::jsonb END) kv(key, value)
      CROSS JOIN LATERAL ${urlsIn(Prisma.sql`kv.value`)} u
      WHERE ${legacyKind} IS NOT NULL
      UNION ALL
      SELECT e.id, 'video', u.url
      FROM entries e
      CROSS JOIN LATERAL ${urlsIn(Prisma.sql`(e.note->'video_clips')`)} u
      WHERE jsonb_typeof(e.note) = 'object'
    ),
    links AS MATERIALIZED (
      SELECT DISTINCT ON (r.corpus_id, r.url) r.corpus_id, e.category, e.created_at, r.kind, r.url
      FROM raw_links r JOIN entries e ON e.id = r.corpus_id
      WHERE r.url ~* '^https?://'
      ORDER BY r.corpus_id, r.url, r.kind
    )`;
}

/** Media totals per group key, each resource counted once per group. */
function mediaAggregate(groupBy: Prisma.Sql, groupAlias: string) {
  return Prisma.sql`
    SELECT g.grp AS ${Prisma.raw(groupAlias)}, g.kind,
      count(*)::int AS n,
      coalesce(sum(a.duration_seconds), 0)::float8 AS duration,
      count(*) FILTER (WHERE a.duration_seconds IS NULL)::int AS duration_missing,
      coalesce(sum(a.size_bytes), 0)::float8 AS bytes,
      count(*) FILTER (WHERE a.size_bytes IS NULL)::int AS size_missing,
      count(*) FILTER (WHERE a.probe_status = 'ok')::int AS probed
    FROM (SELECT DISTINCT ON (${groupBy}, url) ${groupBy} AS grp, url, kind FROM links ORDER BY ${groupBy}, url, kind) g
    LEFT JOIN corpus_media_assets a ON a.url = g.url
    GROUP BY 1, 2`;
}

type MediaRow = {
  kind: AssetMediaType;
  n: number;
  duration: number;
  duration_missing: number;
  bytes: number;
  size_missing: number;
  probed: number;
};

const emptyMedia = (): MediaStat => ({
  count: 0,
  duration: { value: 0, missing: 0 },
  size: { value: 0, missing: 0 },
});

/** Folds per-kind rows into the shape the UI needs. Pure — covered by tests. */
export function foldMedia(rows: MediaRow[]) {
  const by = Object.fromEntries(ASSET_MEDIA_TYPES.map((k) => [k, emptyMedia()])) as Record<AssetMediaType, MediaStat>;
  const size: Measure = { value: 0, missing: 0 };
  let resources = 0;
  let probed = 0;
  for (const row of rows) {
    const stat = by[row.kind];
    if (!stat) continue;
    stat.count += row.n;
    stat.duration.value += row.duration;
    stat.duration.missing += row.duration_missing;
    stat.size.value += row.bytes;
    stat.size.missing += row.size_missing;
    size.value += row.bytes;
    size.missing += row.size_missing;
    resources += row.n;
    probed += row.probed;
  }
  return { by, size, resources, probed };
}

/* ---------- Queries ---------- */

type DatasetBaseRow = {
  name: string;
  id: number;
  nickname: string | null;
  content_attribute: string;
  is_public: boolean;
  entries: number;
  text_entries: number;
  last_ingested_at: Date | null;
};

/** One scan of the corpus: per-dataset rows plus deduplicated platform totals (grp = NULL). */
export async function computeSnapshot(
  db: Pick<Prisma.TransactionClient, "$queryRaw"> = prisma,
  datasetNames: string[] | null = null,
): Promise<{ overview: AssetOverview; datasets: AssetDatasetRow[] }> {
  const namesFilter = (column: string) => datasetNames === null ? Prisma.sql`TRUE` : datasetNames.length ? Prisma.sql`${Prisma.raw(column)} IN (${Prisma.join(datasetNames)})` : Prisma.sql`FALSE`;
  const [base, media] = await Promise.all([
    db.$queryRaw<DatasetBaseRow[]>`
      SELECT k.name, k.id::int AS id, k.nickname, k.content_attribute, k.is_public,
        count(c.id)::int AS entries,
        count(c.id) FILTER (WHERE btrim(c.data) <> '')::int AS text_entries,
        max(c.created_at) AS last_ingested_at
      FROM cantonese_categories k JOIN cantonese_corpus_all c ON c.category = k.name
      WHERE ${namesFilter("k.name")}
      GROUP BY k.name, k.id, k.nickname, k.content_attribute, k.is_public`,
    db.$queryRaw<Array<MediaRow & { grp: string | null }>>`
      WITH ${linksCte(namesFilter("c.category"))}
      ${mediaAggregate(Prisma.sql`category`, "grp")}
      UNION ALL
      ${mediaAggregate(Prisma.sql`NULL::text`, "grp")}`,
  ]);
  const mediaBy = new Map<string | null, MediaRow[]>();
  for (const row of media) mediaBy.set(row.grp, [...(mediaBy.get(row.grp) ?? []), row]);
  const datasets = base.map((b): AssetDatasetRow => {
    const m = foldMedia(mediaBy.get(b.name) ?? []);
    return {
      name: b.name,
      id: b.id,
      nickname: b.nickname,
      contentAttribute: b.content_attribute,
      isPublic: b.is_public,
      entries: b.entries,
      textEntries: b.text_entries,
      media: m.by,
      size: m.size,
      lastIngestedAt: b.last_ingested_at?.toISOString() ?? null,
    };
  });
  const platform = foldMedia(mediaBy.get(null) ?? []);
  const overview: AssetOverview = {
    datasets: datasets.length,
    publicDatasets: datasets.filter((d) => d.isPublic).length,
    privateDatasets: datasets.filter((d) => !d.isPublic).length,
    entries: datasets.reduce((sum, d) => sum + d.entries, 0),
    media: platform.by,
    size: platform.size,
    resources: platform.resources,
    probedResources: platform.probed,
    computedAt: new Date().toISOString(),
  };
  return { overview, datasets };
}

/** Hourly snapshot; the refresh endpoint expires CORPUS_ASSETS_TAG to force a recompute. */
export const loadAssetSnapshot = unstable_cache(
  () => computeSnapshot(),
  ["corpus-assets-snapshot-v1"],
  { revalidate: 3600, tags: [CORPUS_ASSETS_TAG] },
);

export type AssetDatasetDetail = {
  dataset: AssetDatasetRow & { description: string | null; createdAt: string };
  computedAt: string;
  trend: Array<{ day: string; entries: number; avSeconds: number; avMissing: number }>;
  periodEntries: number;
  periodAvSeconds: Measure;
  periodAvResources: number;
};

export async function loadAssetDataset(name: string, range: DateRange): Promise<AssetDatasetDetail | null> {
  const category = await prisma.cantonese_categories.findUnique({
    where: { name },
    select: { description: true, created_at: true },
  });
  if (!category) return null;
  const { overview, datasets } = await loadAssetSnapshot();
  const row = datasets.find((d) => d.name === name);
  if (!row) return null;

  const dayOf = (col: string) => Prisma.sql`to_char(${Prisma.raw(col)} AT TIME ZONE ${TZ}, 'YYYY-MM-DD')`;
  const [entryDays, avDays] = await Promise.all([
    prisma.$queryRaw<Array<{ day: string; n: number }>>`
      SELECT ${dayOf("created_at")} AS day, count(*)::int AS n
      FROM cantonese_corpus_all
      WHERE category = ${name} AND created_at >= ${range.start} AND created_at < ${range.end}
      GROUP BY 1`,
    // A resource is "new" on the day its first entry in this dataset was created.
    prisma.$queryRaw<Array<{ day: string; seconds: number; missing: number; resources: number }>>`
      WITH ${linksCte(Prisma.sql`c.category = ${name}`)}
      SELECT ${dayOf("f.first_at")} AS day,
        coalesce(sum(a.duration_seconds), 0)::float8 AS seconds,
        count(*) FILTER (WHERE a.duration_seconds IS NULL)::int AS missing,
        count(*)::int AS resources
      FROM (SELECT url, min(created_at) AS first_at FROM links WHERE kind IN ('audio', 'video') GROUP BY url) f
      LEFT JOIN corpus_media_assets a ON a.url = f.url
      WHERE f.first_at >= ${range.start} AND f.first_at < ${range.end}
      GROUP BY 1`,
  ]);

  const entriesBy = new Map(entryDays.map((r) => [r.day, r.n]));
  const avBy = new Map(avDays.map((r) => [r.day, r]));
  const trend: AssetDatasetDetail["trend"] = [];
  for (let t = range.start.getTime(); t < range.end.getTime(); t += 86_400_000) {
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(t));
    const av = avBy.get(day);
    trend.push({ day, entries: entriesBy.get(day) ?? 0, avSeconds: av?.seconds ?? 0, avMissing: av?.missing ?? 0 });
  }

  return {
    dataset: { ...row, description: category.description, createdAt: category.created_at.toISOString() },
    computedAt: overview.computedAt,
    trend,
    periodEntries: trend.reduce((s, d) => s + d.entries, 0),
    periodAvSeconds: {
      value: trend.reduce((s, d) => s + d.avSeconds, 0),
      missing: trend.reduce((s, d) => s + d.avMissing, 0),
    },
    periodAvResources: avDays.reduce((s, d) => s + d.resources, 0),
  };
}

/**
 * Registers every media URL referenced by any entry as a pending asset (input for
 * the probe script). Runs inside the database: shipping ~41k rows to the client
 * takes minutes through the pooler. Returns how many new URLs were added.
 */
export async function registerReferencedMedia() {
  return prisma.$executeRaw`
    WITH ${linksCte()}
    INSERT INTO corpus_media_assets (url, media_type)
    SELECT DISTINCT ON (url) url, kind FROM links ORDER BY url, kind
    ON CONFLICT (url) DO NOTHING`;
}
