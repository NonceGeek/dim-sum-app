import { z } from "zod";

/**
 * First-party analytics event catalog (#396). Shared by the browser tracker, the
 * WeChat miniprogram (source "miniprogram") and the ingest API: anything not
 * listed here is dropped server-side.
 * Columns hold the fields the dashboard groups by; everything else goes to `properties`.
 */
/**
 * Result sections. Stored values follow the search API; the PM spec (#508) names
 * them result_level exact / related / recommended — see RESULT_LEVEL_LABELS.
 */
export const SEARCH_SECTIONS = ["primary", "similar", "recommended"] as const;
export const RESULT_LEVEL_LABELS = {
  primary: "exact",
  similar: "related",
  recommended: "recommended",
} as const;
/** Video load timeout before first playback (#508): counts as error_type "timeout". */
export const VIDEO_LOAD_TIMEOUT_MS = 15_000;
export const VIDEO_ERROR_TYPES = [
  "timeout",
  "network",
  "resource_unavailable",
  "unsupported",
  "unknown",
] as const;
export const VIDEO_FALLBACK_TYPES = ["text", "text_audio", "none"] as const;
export const SHARE_COPY_ENTRIES = ["share_panel", "share_card"] as const;
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
const uuid = z.string().uuid();
const query = z.string().trim().max(100);
const section = z.enum(SEARCH_SECTIONS);
const mediaType = z.string().trim().max(20);

/** Accept pre-#508 clients, but reject partially supplied enhanced parameter groups. */
function enhancedGroup<T extends z.AnyZodObject>(schema: T, fields: string[], required = fields) {
  return schema.superRefine((data, ctx) => {
    if (!fields.some((field) => data[field] !== undefined)) return;
    for (const field of required) {
      if (data[field] === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: "Incomplete enhanced analytics parameters" });
    }
  });
}

const audioFields = z.object({
  entryId:id,
  audioId:z.string().trim().min(1).max(300).regex(/^\/[^?#\s]*$/),
  playSessionId:uuid,
  surface:z.enum(["search_result","entry_detail"]),
  target:z.enum(["expression","example"]),
  senseIndex:z.number().int().min(0).max(100),
  exampleIndex:z.number().int().min(0).max(2).optional(),
});
const validAudioTarget = (v:z.infer<typeof audioFields>) => v.target === "example" ? v.exampleIndex !== undefined : v.exampleIndex === undefined;
const feedbackType = z.enum(["content_error","audio_issue","suggestion","other"]);

export const CLIENT_EVENT_SCHEMAS = {
  // landing=true marks the first view of a visit; only it carries the external referrer.
  // scene is the WeChat miniprogram launch scene value (e.g. 1007 chat card, 1011 QR code).
  page_view: z.object({
    landing: z.boolean().optional(),
    scene: z.number().int().min(0).max(100000).optional(),
  }),
  search_submit: z.object({
    requestId: z.string().uuid().optional(),
    origin: z.enum(["search_box", "history"]).optional(),
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
    requestId: z.string().uuid().optional(),
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
  // Fired on actual playback start (`playing`), once per player session (#508).
  // query/section are only present when the player was opened from search results.
  video_play: enhancedGroup(z.object({
    entryId: id.optional(),
    videoId: z.string().trim().min(1).max(300).optional(),
    playSessionId: uuid.optional(),
    surface: z.enum(VIDEO_SURFACES),
    query: query.optional(),
    section: section.optional(),
  }), ["videoId", "playSessionId", "query", "section"], ["videoId", "playSessionId"]),
  // Load error or timeout before first playback, once per load attempt (#508).
  video_load_failed: enhancedGroup(z.object({
    entryId: id.optional(),
    videoId: z.string().trim().min(1).max(300).optional(),
    playSessionId: uuid.optional(),
    loadAttemptId: uuid.optional(),
    errorType: z.enum(VIDEO_ERROR_TYPES).optional(),
    loadElapsedMs: z.number().int().min(0).max(600_000).optional(),
    fallbackType: z.enum(VIDEO_FALLBACK_TYPES).optional(),
    reason: z.enum(["load_error", "play_rejected"]).optional(),
    surface: z.enum(VIDEO_SURFACES),
    query: query.optional(),
    section: section.optional(),
  }), ["videoId", "playSessionId", "loadAttemptId", "errorType", "loadElapsedMs", "fallbackType", "query", "section"], ["videoId", "playSessionId", "loadAttemptId", "errorType", "loadElapsedMs", "fallbackType"]),
  // After the share preview has rendered, once per opening (#508).
  share_card_open: z.object({ entryId: id, shareId: uuid.optional(), surface: z.enum(SHARE_SURFACES) }),
  share_image_download: z.object({ entryId: id, shareId: uuid.optional(), success: z.boolean() }),
  // Only after the clipboard write succeeded (#508).
  share_link_copy: enhancedGroup(z.object({ entryId: id, shareId: uuid.optional(), copyEntry: z.enum(SHARE_COPY_ENTRIES).optional() }), ["shareId", "copyEntry"]),
  share_card_link_click: z.object({ entryId: id, shareId: uuid.optional(), surface: z.enum(SHARE_SURFACES) }),
  // A visitor landed through a share link and the target content loaded (#508).
  share_link_open: enhancedGroup(z.object({
    entryId: id,
    shareId: uuid.optional(),
    landingVisitId: uuid.optional(),
    sourceChannel: z.string().trim().min(1).max(40).optional(),
  }), ["shareId", "landingVisitId", "sourceChannel"], ["landingVisitId", "sourceChannel"]),
  audio_play: audioFields.refine(validAudioTarget, { message: "Example audio requires an exampleIndex" }),
  audio_error: audioFields.extend({ loadAttemptId: uuid, errorType: z.enum(["timeout","network","resource_unavailable","unsupported","unknown"]) }).refine(validAudioTarget, { message: "Example audio requires an exampleIndex" }),
  feedback_submit: z.discriminatedUnion("status", [
    z.object({requestId:uuid,type:feedbackType,status:z.literal("success"),feedbackId:uuid}),
    z.object({requestId:uuid,type:feedbackType,status:z.literal("error"),errorCode:z.enum(["INVALID_FEEDBACK","INVALID_JSON","BODY_TOO_LARGE","INVALID_TOKEN","ENTRY_UNAVAILABLE","REQUEST_CONFLICT","RATE_LIMITED","SERVICE_UNAVAILABLE","NETWORK_ERROR"])})
  ]),
  // Miniprogram forward to a chat (onShareAppMessage) or Moments (onShareTimeline).
  mp_share: z.object({
    entryId: id.optional(),
    shareId: uuid.optional(),
    channel: z.enum(MP_SHARE_CHANNELS),
  }),
} as const;

export type ClientEventName = keyof typeof CLIENT_EVENT_SCHEMAS;
export type ClientEventProps<N extends ClientEventName> = z.infer<
  (typeof CLIENT_EVENT_SCHEMAS)[N]
>;

export const SERVER_EVENT_NAMES = ["search_request"] as const;
export type AnalyticsEventName = ClientEventName | (typeof SERVER_EVENT_NAMES)[number];

/** Query params appended to copied share links so landings can be attributed (#508). */
export const SHARE_ATTRIBUTION_PARAM = "from";
export const SHARE_ATTRIBUTION_VALUE = "share";
export const SHARE_ID_PARAM = "sid";
/** Used when the share channel cannot be identified; never guessed (#508). */
export const DEFAULT_SHARE_CHANNEL = "shared_link";

/** The keyword that produced the results, trimmed only (#508 search_keyword), capped at 100. */
export function normalizeQuery(value: string | null | undefined) {
  const q = (value ?? "").trim();
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
  app: z.enum(["search-app","review-app","corpus-collection-app","yue-cube-game"]).optional(),
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
