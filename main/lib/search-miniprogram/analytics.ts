import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
export function searchAnalyticsSql(start: Date, end: Date) {
  return Prisma.sql`
 SELECT count(*) FILTER (WHERE event_name='search_request' AND coalesce((properties->>'paged')::boolean,false)=false)::int AS requests,
 count(*) FILTER (WHERE event_name='search_request' AND coalesce((properties->>'paged')::boolean,false)=false AND NOT(properties?'error'))::int AS successful,
 count(*) FILTER (WHERE event_name='search_request' AND coalesce((properties->>'paged')::boolean,false)=false AND properties?'error')::int AS errors,
 count(*) FILTER (WHERE event_name='search_request' AND coalesce((properties->>'paged')::boolean,false)=false AND NOT(properties?'error') AND (properties->>'primaryCount')::int>0)::int AS direct,
 count(*) FILTER (WHERE event_name='search_request' AND coalesce((properties->>'paged')::boolean,false)=false AND NOT(properties?'error') AND (properties->>'primaryCount')::int=0 AND (properties->>'similarCount')::int>0)::int AS related_only,
 count(*) FILTER (WHERE event_name='search_request' AND coalesce((properties->>'paged')::boolean,false)=false AND NOT(properties?'error') AND (properties->>'primaryCount')::int=0 AND (properties->>'similarCount')::int=0)::int AS empty,
 count(*) FILTER (WHERE event_name='page_view')::int AS page_views,
 count(DISTINCT anonymous_id) FILTER (WHERE event_name='page_view')::int AS visitors,
 count(*) FILTER (WHERE event_name='search_result_click')::int AS result_clicks,
 count(*) FILTER (WHERE event_name='audio_play')::int AS audio_plays,
 count(*) FILTER (WHERE event_name='audio_error')::int AS audio_errors,
 count(*) FILTER (WHERE event_name='mp_share')::int AS share_triggers,
 count(*) FILTER (WHERE event_name='feedback_submit' AND properties->>'status'='error')::int AS feedback_errors
 FROM analytics_events WHERE occurred_at>=${start} AND occurred_at<${end} AND properties->>'app'='search-app'
 `;
}
export function parseDays(from: string | null, to: string | null) {
  const valid = (v: string | null) =>
    v &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !Number.isNaN(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v;
  if (!valid(from) || !valid(to)) return null;
  const start = new Date(from + "T00:00:00+08:00"),
    end = new Date(new Date(to + "T00:00:00+08:00").getTime() + 86400000);
  return end > start && end.getTime() - start.getTime() <= 31 * 86400000
    ? { start, end }
    : null;
}
export async function searchAnalytics(start: Date, end: Date) {
  const [rows, feedbacks] = await prisma.$transaction([
    prisma.$queryRaw<Record<string, number>[]>(searchAnalyticsSql(start, end)),
    prisma.search_feedback.count({
      where: { created_at: { gte: start, lt: end } },
    }),
  ]);
  const r = rows[0];
  return {
    ...r,
    feedbacks,
    directRate: r.successful ? r.direct / r.successful : null,
    emptyRate: r.successful ? r.empty / r.successful : null,
  };
}
