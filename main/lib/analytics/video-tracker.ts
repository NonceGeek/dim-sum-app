import {
  VIDEO_LOAD_TIMEOUT_MS,
  type SEARCH_SECTIONS,
  type VIDEO_ERROR_TYPES,
  type VIDEO_FALLBACK_TYPES,
  type VIDEO_SURFACES,
} from "./events";

export type VideoErrorType = (typeof VIDEO_ERROR_TYPES)[number];

export type VideoTrackingContext = {
  entryId?: string;
  videoId: string;
  surface: (typeof VIDEO_SURFACES)[number];
  fallbackType: (typeof VIDEO_FALLBACK_TYPES)[number];
  /** Only when the player was opened from search results. */
  query?: string;
  section?: (typeof SEARCH_SECTIONS)[number];
};

type Emit = (
  name: "video_play" | "video_load_failed",
  props: Record<string, unknown>,
) => void;

type Clock = {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  uuid: () => string;
};

/**
 * Video load/play state for one player session (#508):
 * - video_play once, on actual playback; pause/resume never repeats it.
 * - video_load_failed at most once per load attempt (error and timeout don't both count);
 *   an explicit retry starts a new attempt.
 * - Only failures before the first playback count; closing, pausing or leaving cancels.
 */
export class VideoLoadTracker {
  readonly playSessionId: string;
  private played = false;
  private attempt: { id: string; startedAt: number; settled: boolean } | null = null;
  private timer: unknown = null;

  constructor(
    private readonly context: VideoTrackingContext,
    private readonly emit: Emit,
    private readonly clock: Clock,
  ) {
    this.playSessionId = clock.uuid();
  }

  private base() {
    const { entryId, videoId, surface, query, section } = this.context;
    return {
      ...(entryId ? { entryId } : {}),
      videoId,
      playSessionId: this.playSessionId,
      surface,
      ...(query ? { query } : {}),
      ...(section ? { section } : {}),
    };
  }

  private settle() {
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
    if (this.attempt) this.attempt.settled = true;
  }

  /** User pressed play / retry, or a dialog autoplays. Ignored while an attempt is pending. */
  startAttempt() {
    if (this.played || (this.attempt && !this.attempt.settled)) return;
    this.attempt = { id: this.clock.uuid(), startedAt: this.clock.now(), settled: false };
    this.timer = this.clock.setTimeout(() => this.fail("timeout"), VIDEO_LOAD_TIMEOUT_MS);
  }

  /** The media element fired `playing`. */
  playing() {
    if (this.played) return;
    this.played = true;
    this.settle();
    this.emit("video_play", this.base());
  }

  fail(errorType: VideoErrorType) {
    if (this.played || !this.attempt || this.attempt.settled) return;
    const attempt = this.attempt;
    this.settle();
    this.emit("video_load_failed", {
      ...this.base(),
      loadAttemptId: attempt.id,
      errorType,
      loadElapsedMs: Math.max(0, Math.round(this.clock.now() - attempt.startedAt)),
      fallbackType: this.context.fallbackType,
    });
  }

  /** Pause before first playback, close, page hidden or unmount: not a failure. */
  cancel() {
    if (!this.played) this.settle();
  }
}

/** Maps HTMLMediaElement.error codes; null means "aborted by the user", not a failure. */
export function mediaErrorType(code: number | undefined): VideoErrorType | null {
  switch (code) {
    case 1: // MEDIA_ERR_ABORTED
      return null;
    case 2: // MEDIA_ERR_NETWORK
      return "network";
    case 3: // MEDIA_ERR_DECODE
      return "unsupported";
    case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED (also unreachable / 404 sources)
      return "resource_unavailable";
    default:
      return "unknown";
  }
}

/** Maps video.play() rejections; null means interrupted or blocked autoplay, not a failure. */
export function playRejectionType(error: unknown): VideoErrorType | null {
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  if (name === "AbortError" || name === "NotAllowedError") return null;
  if (name === "NotSupportedError") return "unsupported";
  return "unknown";
}

/** Stable video identifier without host, query or tokens (never the full signed link). */
export function videoIdFromUrl(url: string) {
  try {
    return new URL(url, "https://placeholder.invalid").pathname.slice(0, 300) || url.slice(0, 300);
  } catch {
    return url.split(/[?#]/)[0].slice(0, 300);
  }
}
