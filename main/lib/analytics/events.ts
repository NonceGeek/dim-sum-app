import { z } from "zod";

/**
 * First-party analytics event catalog (#396). Shared by the browser tracker, the
 * WeChat miniprogram (source "miniprogram") and the ingest API: anything not
 * listed here is dropped server-side.
 * Columns hold the fields the dashboard groups by; everything else goes to `properties`.
 */
export const SEARCH_SECTIONS = ["primary", "similar", "recommended"] as const;
export const SHARE_SURFACES = ["search_primary", "entry_detail", "miniprogram"] as const;
export const VIDEO_SURFACES = [
  "search_primary",
  "search_tile",
  "preview_dialog",
  "entry_detail",
  "miniprogram",
] as const;
export const MP_SHARE_CHANNELS = ["chat", "timeline"] as const;

const id = z.string().trim().min(1).max(100);
const query = z.string().trim().max(100);
const section = z.enum(SEARCH_SECTIONS);
const mediaType = z.string().trim().max(20);

export const CLIENT_EVENT_SCHEMAS = {
  // landing=true marks the first view of a visit; only it carries the external referrer.
  // scene is the WeChat miniprogram launch scene value (e.g. 1007 chat card, 1011 QR code).
  page_view: z.object({
    landing: z.boolean().optional(),
    scene: z.number().int().min(0).max(100000).optional(),
  }),
  search_submit: z.object({
    query,
    dataset: z.string().max(500).optional(),
    mediaType: mediaType.optional(),
  }),
  search_section_impression: z.object({
    query,
    section,
    resultCount: z.number().int().min(0).max(1000),
    page: z.number().int().min(0).max(1000).optional(),
    status: z.enum(["success", "fallback", "error"]).optional(),
    mediaType: mediaType.optional(),
  }),
  search_result_click: z.object({
    query,
    section,
    entryId: id,
    position: z.number().int().min(0).max(1000),
    contentAttribute: z.string().max(40).optional(),
  }),
  media_filter_change: z.object({
    query,
    mediaType: mediaType.optional(),
    previous: mediaType.optional(),
  }),
  video_play: z.object({ entryId: id.optional(), surface: z.enum(VIDEO_SURFACES) }),
  video_load_failed: z.object({
    entryId: id.optional(),
    surface: z.enum(VIDEO_SURFACES),
    reason: z.enum(["load_error", "play_rejected"]).optional(),
  }),
  share_card_open: z.object({ entryId: id, surface: z.enum(SHARE_SURFACES) }),
  share_image_download: z.object({ entryId: id, success: z.boolean() }),
  share_link_copy: z.object({ entryId: id }),
  share_card_link_click: z.object({ entryId: id, surface: z.enum(SHARE_SURFACES) }),
  share_link_open: z.object({ entryId: id }),
  // Miniprogram forward to a chat (onShareAppMessage) or Moments (onShareTimeline).
  mp_share: z.object({
    entryId: id.optional(),
    channel: z.enum(MP_SHARE_CHANNELS),
  }),
} as const;

export type ClientEventName = keyof typeof CLIENT_EVENT_SCHEMAS;
export type ClientEventProps<N extends ClientEventName> = z.infer<
  (typeof CLIENT_EVENT_SCHEMAS)[N]
>;

export const SERVER_EVENT_NAMES = ["search_request"] as const;
export type AnalyticsEventName = ClientEventName | (typeof SERVER_EVENT_NAMES)[number];

/** Query param appended to copied share links so landings can be attributed. */
export const SHARE_ATTRIBUTION_PARAM = "from";
export const SHARE_ATTRIBUTION_VALUE = "share";

/** Lowercase, collapse spaces, cap length: one keyword, one dashboard row. */
export function normalizeQuery(value: string | null | undefined) {
  const q = (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  return q ? q.slice(0, 100) : null;
}

export function isBotUserAgent(ua: string | null) {
  return !ua || /bot|spider|crawl|slurp|headless|lighthouse|preview|facebookexternalhit|curl|wget|python|axios|node-fetch/i.test(ua);
}

export function deviceFromUserAgent(ua: string | null) {
  if (!ua) return "unknown";
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobi|iphone|android/i.test(ua)) return "mobile";
  return "desktop";
}

export function referrerHost(referrer: string | null | undefined, ownHost?: string) {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    return ownHost && host === ownHost.replace(/^www\./, "") ? "(internal)" : host;
  } catch {
    return null;
  }
}

const envelope = z.object({
  name: z.string().max(60),
  props: z.record(z.unknown()).default({}),
  time: z.string().datetime({ offset: true }).optional(),
  path: z.string().max(300).optional(),
  referrer: z.string().max(500).optional(),
  locale: z.string().max(10).optional(),
});

export const ingestBatchSchema = z.object({
  anonymousId: z.string().uuid(),
  sessionId: z.string().uuid(),
  source: z.enum(["web", "miniprogram"]).default("web"),
  events: z.array(envelope).min(1).max(20),
});
export type IngestBatch = z.infer<typeof ingestBatchSchema>;

/** Validates one client event; returns null when the name or payload is not allowed. */
export function parseClientEvent(name: string, props: unknown) {
  const schema = CLIENT_EVENT_SCHEMAS[name as ClientEventName];
  if (!schema) return null;
  const parsed = schema.safeParse(props);
  return parsed.success ? (parsed.data as Record<string, unknown>) : null;
}
