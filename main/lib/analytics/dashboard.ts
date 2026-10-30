import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Dashboard aggregations over analytics_events. Days are Asia/Shanghai calendar days. */
export const DASHBOARD_TABS = ["overview", "search", "content", "traffic"] as const;
export type DashboardTab = (typeof DASHBOARD_TABS)[number];

const TZ = "Asia/Shanghai";
const MAX_RANGE_DAYS = 366;

export type DateRange = { from: string; to: string; start: Date; end: Date };

/** Parses inclusive YYYY-MM-DD bounds; returns null when invalid or too long. */
export function parseRange(from: string | null, to: string | null): DateRange | null {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!from || !to || !re.test(from) || !re.test(to)) return null;
  const start = new Date(`${from}T00:00:00+08:00`);
  const end = new Date(`${to}T00:00:00+08:00`);
  end.setUTCDate(end.getUTCDate() + 1);
  const days = (end.getTime() - start.getTime()) / 86_400_000;
  if (!Number.isFinite(days) || days < 1 || days > MAX_RANGE_DAYS) return null;
  return { from, to, start, end };
}

/** Every calendar day of the range, so trends show gaps as zero instead of skipping them. */
function rangeDays(r: DateRange) {
  const days: string[] = [];
  for (let t = r.start.getTime(); t < r.end.getTime(); t += 86_400_000)
    days.push(new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(t)));
  return days;
}

function fillDays<T extends { day: string }>(r: DateRange, rows: T[], empty: (day: string) => T) {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  return rangeDays(r).map((d) => byDay.get(d) ?? empty(d));
}

const n = (value: unknown) => (value === null || value === undefined ? 0 : Number(value));
const inRange = (r: DateRange) => Prisma.sql`occurred_at >= ${r.start} AND occurred_at < ${r.end}`;
const day = Prisma.sql`to_char(occurred_at AT TIME ZONE ${TZ}, 'YYYY-MM-DD')`;
// Primary-bearing requests that are not pagination: one per executed search.
// Failed requests are excluded so outages don't read as "no match".
const searchRequests = Prisma.sql`event_name = 'search_request' AND section IN ('primary', 'all') AND coalesce((properties->>'paged')::boolean, false) = false AND NOT (properties ? 'error')`;

type Rows = Array<Record<string, unknown>>;

async function overview(r: DateRange) {
  const [kpi, daily] = await prisma.$transaction([
    prisma.$queryRaw<Rows>`
      SELECT
        count(*) FILTER (WHERE event_name = 'page_view')::int AS pv,
        count(DISTINCT anonymous_id) FILTER (WHERE event_name = 'page_view')::int AS uv,
        count(DISTINCT session_id) FILTER (WHERE source = 'web')::int AS sessions,
        count(*) FILTER (WHERE event_name = 'search_submit')::int AS searches,
        count(*) FILTER (WHERE ${searchRequests})::int AS search_requests,
        count(*) FILTER (WHERE ${searchRequests} AND (properties->>'primaryCount')::int = 0)::int AS no_primary,
        count(*) FILTER (WHERE event_name = 'share_link_copy')::int AS share_copies,
        count(*) FILTER (WHERE event_name = 'share_link_open')::int AS share_opens,
        count(*) FILTER (WHERE event_name = 'video_play')::int AS video_plays
      FROM analytics_events WHERE ${inRange(r)}`,
    prisma.$queryRaw<Rows>`
      SELECT ${day} AS day,
        count(*) FILTER (WHERE event_name = 'page_view')::int AS pv,
        count(DISTINCT anonymous_id) FILTER (WHERE event_name = 'page_view')::int AS uv,
        count(*) FILTER (WHERE event_name = 'search_submit')::int AS searches,
        count(*) FILTER (WHERE event_name IN ('share_link_copy', 'share_link_open', 'share_card_open'))::int AS shares
      FROM analytics_events WHERE ${inRange(r)}
      GROUP BY 1 ORDER BY 1`,
  ]);
  const k = kpi[0] ?? {};
  return {
    kpis: {
      pv: n(k.pv),
      uv: n(k.uv),
      sessions: n(k.sessions),
      searches: n(k.searches),
      noPrimaryRate: n(k.search_requests) ? n(k.no_primary) / n(k.search_requests) : null,
      shareCopies: n(k.share_copies),
      shareOpens: n(k.share_opens),
      videoPlays: n(k.video_plays),
    },
    daily: fillDays(
      r,
      daily.map((d) => ({
        day: String(d.day),
        pv: n(d.pv),
        uv: n(d.uv),
        searches: n(d.searches),
        shares: n(d.shares),
      })),
      (day) => ({ day, pv: 0, uv: 0, searches: 0, shares: 0 }),
    ),
  };
}

async function search(r: DateRange) {
  const [totals, topQueries, noPrimaryQueries, impressions, clicks, mediaFilters, latency, fallbacks, daily] =
    await prisma.$transaction([
      prisma.$queryRaw<Rows>`
        SELECT
          count(*) FILTER (WHERE event_name = 'search_submit')::int AS searches,
          count(*) FILTER (WHERE ${searchRequests})::int AS requests,
          count(*) FILTER (WHERE ${searchRequests} AND (properties->>'primaryCount')::int = 0)::int AS no_primary,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY (properties->>'latencyMs')::int)
            FILTER (WHERE event_name = 'search_request')::int AS p95
        FROM analytics_events WHERE ${inRange(r)}`,
      prisma.$queryRaw<Rows>`
        SELECT query, count(*)::int AS searches, count(DISTINCT anonymous_id)::int AS users
        FROM analytics_events
        WHERE ${inRange(r)} AND event_name = 'search_submit' AND query IS NOT NULL
        GROUP BY query ORDER BY searches DESC, query LIMIT 30`,
      prisma.$queryRaw<Rows>`
        SELECT query, count(*)::int AS searches
        FROM analytics_events
        WHERE ${inRange(r)} AND ${searchRequests} AND (properties->>'primaryCount')::int = 0 AND query IS NOT NULL
        GROUP BY query ORDER BY searches DESC, query LIMIT 30`,
      prisma.$queryRaw<Rows>`
        SELECT section,
          count(*)::int AS impressions,
          count(*) FILTER (WHERE (properties->>'resultCount')::int = 0)::int AS empty,
          coalesce(avg((properties->>'resultCount')::int), 0)::float AS avg_results
        FROM analytics_events
        WHERE ${inRange(r)} AND event_name = 'search_section_impression'
        GROUP BY section`,
      prisma.$queryRaw<Rows>`
        SELECT section, count(*)::int AS clicks
        FROM analytics_events
        WHERE ${inRange(r)} AND event_name = 'search_result_click'
        GROUP BY section`,
      prisma.$queryRaw<Rows>`
        SELECT coalesce(media_type, 'all') AS media_type, count(*)::int AS changes
        FROM analytics_events
        WHERE ${inRange(r)} AND event_name = 'media_filter_change'
        GROUP BY 1 ORDER BY changes DESC`,
      prisma.$queryRaw<Rows>`
        SELECT section, count(*)::int AS requests,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY (properties->>'latencyMs')::int)::int AS p50,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY (properties->>'latencyMs')::int)::int AS p95,
          max((properties->>'latencyMs')::int)::int AS max
        FROM analytics_events
        WHERE ${inRange(r)} AND event_name = 'search_request'
        GROUP BY section ORDER BY section`,
      prisma.$queryRaw<Rows>`
        SELECT properties->>'semanticStatus' AS status,
          coalesce(properties->>'semanticReason', properties->>'error', 'unknown') AS reason,
          count(*)::int AS requests
        FROM analytics_events
        WHERE ${inRange(r)} AND event_name = 'search_request'
          AND (properties->>'semanticStatus' IN ('fallback', 'error') OR properties ? 'error')
        GROUP BY 1, 2 ORDER BY requests DESC`,
      prisma.$queryRaw<Rows>`
        SELECT ${day} AS day,
          count(*) FILTER (WHERE event_name = 'search_submit')::int AS searches,
          count(*) FILTER (WHERE ${searchRequests} AND (properties->>'primaryCount')::int = 0)::int AS no_primary,
          count(*) FILTER (WHERE ${searchRequests})::int AS requests,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY (properties->>'latencyMs')::int)
            FILTER (WHERE event_name = 'search_request')::int AS p95
        FROM analytics_events WHERE ${inRange(r)}
        GROUP BY 1 ORDER BY 1`,
    ]);
  const clickBySection = new Map(clicks.map((c) => [String(c.section), n(c.clicks)]));
  const tot = totals[0] ?? {};
  return {
    totals: {
      searches: n(tot.searches),
      noPrimaryRate: n(tot.requests) ? n(tot.no_primary) / n(tot.requests) : null,
      p95: tot.p95 === null || tot.p95 === undefined ? null : n(tot.p95),
    },
    topQueries: topQueries.map((q) => ({ query: String(q.query), searches: n(q.searches), users: n(q.users) })),
    noPrimaryQueries: noPrimaryQueries.map((q) => ({ query: String(q.query), searches: n(q.searches) })),
    sections: ["primary", "similar", "recommended"].map((section) => {
      const imp = impressions.find((i) => i.section === section) ?? {};
      const withResults = n(imp.impressions) - n(imp.empty);
      const sectionClicks = clickBySection.get(section) ?? 0;
      return {
        section,
        impressions: n(imp.impressions),
        emptyRate: n(imp.impressions) ? n(imp.empty) / n(imp.impressions) : null,
        avgResults: n(imp.avg_results),
        clicks: sectionClicks,
        ctr: withResults ? sectionClicks / withResults : null,
      };
    }),
    mediaFilters: mediaFilters.map((m) => ({ mediaType: String(m.media_type), changes: n(m.changes) })),
    latency: latency.map((l) => ({
      section: String(l.section),
      requests: n(l.requests),
      p50: n(l.p50),
      p95: n(l.p95),
      max: n(l.max),
    })),
    fallbacks: fallbacks.map((f) => ({
      status: f.status ? String(f.status) : "error",
      reason: String(f.reason),
      requests: n(f.requests),
    })),
    daily: fillDays(
      r,
      daily.map((d) => ({
        day: String(d.day),
        searches: n(d.searches),
        noPrimaryRate: n(d.requests) ? n(d.no_primary) / n(d.requests) : null,
        p95: d.p95 === null ? null : n(d.p95),
      })),
      // No searches that day: count is 0, but rate and latency are undefined rather than 0.
      (day) => ({ day, searches: 0, noPrimaryRate: null, p95: null }),
    ),
  };
}

async function content(r: DateRange) {
  const [video, videoErrors, funnel, attributedOpens, entries] = await prisma.$transaction([
    prisma.$queryRaw<Rows>`
      SELECT properties->>'surface' AS surface,
        count(*) FILTER (WHERE event_name = 'video_play')::int AS plays,
        count(*) FILTER (WHERE event_name = 'video_load_failed')::int AS failures
      FROM analytics_events
      WHERE ${inRange(r)} AND event_name IN ('video_play', 'video_load_failed')
      GROUP BY 1 ORDER BY plays DESC`,
    // #508 failure breakdown: error type, time to failure and what users fell back to.
    prisma.$queryRaw<Rows>`
      SELECT coalesce(properties->>'errorType', properties->>'reason', 'unknown') AS error_type,
        count(*)::int AS failures,
        round(avg((properties->>'loadElapsedMs')::int))::int AS avg_elapsed_ms,
        count(*) FILTER (WHERE properties->>'fallbackType' = 'text_audio')::int AS text_audio,
        count(*) FILTER (WHERE properties->>'fallbackType' = 'text')::int AS text_only,
        count(*) FILTER (WHERE properties->>'fallbackType' = 'none')::int AS no_fallback
      FROM analytics_events
      WHERE ${inRange(r)} AND event_name = 'video_load_failed'
      GROUP BY 1 ORDER BY failures DESC`,
    prisma.$queryRaw<Rows>`
      SELECT event_name, count(*)::int AS events, count(DISTINCT entry_id)::int AS entries
      FROM analytics_events
      WHERE ${inRange(r)} AND event_name IN
        ('share_card_open', 'share_link_copy', 'share_image_download', 'share_card_link_click', 'share_link_open')
        AND (event_name <> 'share_image_download' OR (properties->>'success')::boolean)
      GROUP BY event_name`,
    // Share-link opens whose share_id matches a share created on the site (#508 attribution).
    prisma.$queryRaw<Rows>`
      SELECT count(*)::int AS opens
      FROM analytics_events o
      WHERE ${Prisma.sql`o.occurred_at >= ${r.start} AND o.occurred_at < ${r.end}`}
        AND o.event_name = 'share_link_open' AND o.properties ? 'shareId'
        AND EXISTS (
          SELECT 1 FROM analytics_events s
          WHERE s.event_name IN ('share_card_open', 'share_link_copy')
            AND s.properties->>'shareId' = o.properties->>'shareId'
        )`,
    prisma.$queryRaw<Rows>`
      SELECT e.entry_id, c.data AS name,
        count(*) FILTER (WHERE e.event_name = 'search_result_click')::int AS clicks,
        count(*) FILTER (WHERE e.event_name IN ('share_card_open', 'share_link_copy'))::int AS shares,
        count(*) FILTER (WHERE e.event_name = 'share_link_open')::int AS share_opens,
        count(*) FILTER (WHERE e.event_name = 'video_play')::int AS video_plays,
        count(*)::int AS total
      FROM analytics_events e
      LEFT JOIN cantonese_corpus_all c ON c.unique_id::text = e.entry_id
      WHERE ${Prisma.sql`e.occurred_at >= ${r.start} AND e.occurred_at < ${r.end}`} AND e.entry_id IS NOT NULL
      GROUP BY e.entry_id, c.data ORDER BY total DESC LIMIT 20`,
  ]);
  const count = (name: string) => n(funnel.find((f) => f.event_name === name)?.events);
  return {
    video: video.map((v) => ({
      surface: String(v.surface ?? "unknown"),
      plays: n(v.plays),
      failures: n(v.failures),
      failureRate: n(v.plays) + n(v.failures) ? n(v.failures) / (n(v.plays) + n(v.failures)) : null,
    })),
    shareFunnel: {
      cardOpens: count("share_card_open"),
      linkCopies: count("share_link_copy"),
      imageDownloads: count("share_image_download"),
      cardLinkClicks: count("share_card_link_click"),
      linkOpens: count("share_link_open"),
      attributedLinkOpens: n(attributedOpens[0]?.opens),
    },
    videoErrors: videoErrors.map((v) => ({
      errorType: String(v.error_type),
      failures: n(v.failures),
      avgElapsedMs: v.avg_elapsed_ms === null ? null : n(v.avg_elapsed_ms),
      textAudio: n(v.text_audio),
      textOnly: n(v.text_only),
      noFallback: n(v.no_fallback),
    })),
    topEntries: entries.map((e) => ({
      entryId: String(e.entry_id),
      name: e.name ? String(e.name).slice(0, 80) : null,
      clicks: n(e.clicks),
      shares: n(e.shares),
      shareOpens: n(e.share_opens),
      videoPlays: n(e.video_plays),
    })),
  };
}

async function traffic(r: DateRange) {
  const pageViews = Prisma.sql`${inRange(r)} AND event_name = 'page_view'`;
  // Collapse /en/... and dynamic ids so pages aggregate by route.
  const route = Prisma.sql`regexp_replace(regexp_replace(coalesce(path, '/'), '^/en(?=/|$)', ''), '/[0-9a-f]{8}-[0-9a-f-]{27,}', '/:id', 'g')`;
  const [sources, scenes, pages, referrers, devices, locales] = await prisma.$transaction([
    prisma.$queryRaw<Rows>`
      SELECT source, count(*)::int AS pv, count(DISTINCT anonymous_id)::int AS uv
      FROM analytics_events WHERE ${pageViews}
      GROUP BY 1 ORDER BY uv DESC`,
    // WeChat launch scene of each miniprogram visit (landing page view only).
    prisma.$queryRaw<Rows>`
      SELECT (properties->>'scene')::int AS scene, count(*)::int AS visits, count(DISTINCT anonymous_id)::int AS uv
      FROM analytics_events WHERE ${pageViews} AND source = 'miniprogram'
        AND properties->>'landing' = 'true' AND properties ? 'scene'
      GROUP BY 1 ORDER BY visits DESC LIMIT 20`,
    prisma.$queryRaw<Rows>`
      SELECT CASE WHEN ${route} = '' THEN '/' ELSE ${route} END AS route,
        count(*)::int AS pv, count(DISTINCT anonymous_id)::int AS uv
      FROM analytics_events WHERE ${pageViews}
      GROUP BY 1 ORDER BY pv DESC LIMIT 30`,
    prisma.$queryRaw<Rows>`
      SELECT coalesce(referrer_host, '(direct)') AS referrer,
        count(*)::int AS visits, count(DISTINCT anonymous_id)::int AS uv
      FROM analytics_events WHERE ${pageViews} AND (referrer_host IS NULL OR referrer_host <> '(internal)')
        AND properties->>'landing' = 'true'
      GROUP BY 1 ORDER BY visits DESC LIMIT 20`,
    prisma.$queryRaw<Rows>`
      SELECT coalesce(device, 'unknown') AS device, count(DISTINCT anonymous_id)::int AS uv, count(*)::int AS pv
      FROM analytics_events WHERE ${pageViews}
      GROUP BY 1 ORDER BY uv DESC`,
    prisma.$queryRaw<Rows>`
      SELECT coalesce(locale, 'unknown') AS locale, count(DISTINCT anonymous_id)::int AS uv, count(*)::int AS pv
      FROM analytics_events WHERE ${pageViews}
      GROUP BY 1 ORDER BY uv DESC`,
  ]);
  return {
    sources: sources.map((s) => ({ source: String(s.source), pv: n(s.pv), uv: n(s.uv) })),
    scenes: scenes.map((s) => ({ scene: n(s.scene), visits: n(s.visits), uv: n(s.uv) })),
    pages: pages.map((p) => ({ route: String(p.route), pv: n(p.pv), uv: n(p.uv) })),
    referrers: referrers.map((x) => ({ referrer: String(x.referrer), visits: n(x.visits), uv: n(x.uv) })),
    devices: devices.map((d) => ({ device: String(d.device), uv: n(d.uv), pv: n(d.pv) })),
    locales: locales.map((l) => ({ locale: String(l.locale), uv: n(l.uv), pv: n(l.pv) })),
  };
}

export async function loadDashboard(tab: DashboardTab, range: DateRange) {
  switch (tab) {
    case "overview":
      return overview(range);
    case "search":
      return search(range);
    case "content":
      return content(range);
    case "traffic":
      return traffic(range);
  }
}
