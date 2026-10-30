"use client";

import { Loader2, Maximize2, Play, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { newAnalyticsId, track } from "@/lib/analytics/client";
import {
  mediaErrorType,
  playRejectionType,
  VideoLoadTracker,
  videoIdFromUrl,
  type VideoTrackingContext,
} from "@/lib/analytics/video-tracker";

/** Tracking context supplied by the caller; videoId is derived from the URL. */
export type VideoAnalytics = Omit<VideoTrackingContext, "videoId">;


type VideoPlayerProps = {
  url: string;
  poster?: string | null;
  compact?: boolean;
  autoPlay?: boolean;
  enlarged?: boolean;
  onPreview?: () => void;
  onAspectRatio?: (ratio: number) => void;
  analytics?: VideoAnalytics;
};

export function VideoPlayer(props: VideoPlayerProps) {
  // Reset playback and preview state when a refreshed result changes its source.
  return <Player key={props.url} {...props} />;
}

function Player({ url, poster, compact = false, autoPlay = false, enlarged = false, onPreview, onAspectRatio, analytics }: VideoPlayerProps) {
  const t = useTranslations("VideoPlayer");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activated, setActivated] = useState(!compact);
  const [loading, setLoading] = useState(autoPlay);
  const [error, setError] = useState(false);
  const previewPending = useRef(!poster && !autoPlay);
  // One tracker per mounted player = one play session (#508).
  const tracker = useRef<VideoLoadTracker | null>(null);
  if (analytics && !tracker.current) {
    tracker.current = new VideoLoadTracker(
      { ...analytics, videoId: videoIdFromUrl(url) },
      (name, props) => track(name, props as never),
      { now: () => performance.now(), setTimeout, clearTimeout: (h) => clearTimeout(h as number), uuid: newAnalyticsId },
    );
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let disposed = false;
    // Only fetch preview data for videos near the viewport.
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (!video.getAttribute("src")) video.src = url;
        observer.disconnect();
        if (autoPlay) {
          tracker.current?.startAttempt();
          void video.play().catch((error) => {
            if (disposed) return;
            const type = playRejectionType(error);
            if (type) tracker.current?.fail(type);
            else tracker.current?.cancel();
            // Some browsers require another gesture after mounting a dialog.
            setLoading(false);
            setActivated(false);
          });
        }
      }
    }, { rootMargin: "200px" });
    observer.observe(video);
    const pauseWhenHidden = () => {
      if (!document.hidden) return;
      video.pause();
      // Leaving the page is not a load failure.
      tracker.current?.cancel();
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => {
      disposed = true;
      tracker.current?.cancel();
      observer.disconnect();
      document.removeEventListener("visibilitychange", pauseWhenHidden);
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [url, autoPlay]);

  const play = async () => {
    const video = videoRef.current;
    if (!video) return;
    previewPending.current = false;
    setActivated(true);
    setLoading(true);
    setError(false);
    if (!video.getAttribute("src")) video.src = url;
    if (video.error) video.load();
    tracker.current?.startAttempt();
    try {
      await video.play();
    } catch (error) {
      setLoading(false);
      const type = playRejectionType(error);
      if (!type) {
        tracker.current?.cancel();
        return;
      }
      setError(true);
      tracker.current?.fail(type);
    }
  };

  return (
    <div className={`relative w-full overflow-hidden rounded-md border border-border bg-black ${compact ? "h-24" : enlarged ? "h-[min(72dvh,720px,calc(100dvh-9rem))]" : "aspect-video"}`}>
      <video
        ref={videoRef}
        controls={activated}
        playsInline
        preload="metadata"
        poster={poster ?? undefined}
        aria-label={t("play")}
        className="h-full w-full object-contain"
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            onAspectRatio?.(video.videoWidth / video.videoHeight);
          }
          // Decode an actual frame without autoplay; metadata alone can stay black.
          if (previewPending.current && video.paused && Number.isFinite(video.duration) && video.duration > 0) {
            previewPending.current = false;
            video.currentTime = Math.min(0.1, video.duration / 2);
          }
        }}
        onPlay={(event) => {
          // Native controls start playback without calling play(); begin the load attempt here too.
          tracker.current?.startAttempt();
          previewPending.current = false;
          setError(false);
          setActivated(true);
          // Avoid overlapping sound when previewing several search results.
          document.querySelectorAll<HTMLMediaElement>("video, audio").forEach((media) => {
            if (media !== event.currentTarget) media.pause();
          });
        }}
        onPlaying={() => {
          setLoading(false);
          // Actual playback start, not the play request (#508).
          tracker.current?.playing();
        }}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        onPause={() => {
          setLoading(false);
          // A pause before first playback (user stopped waiting) is not a failure.
          tracker.current?.cancel();
        }}
        onError={(event) => {
          setError(true);
          setLoading(false);
          const type = mediaErrorType(event.currentTarget.error?.code);
          if (type) tracker.current?.fail(type);
        }}
      />
      {!activated && !error && (
        <button type="button" onClick={onPreview ?? play} aria-label={t(onPreview ? "enlarge" : "play")} aria-haspopup={onPreview ? "dialog" : undefined}
          className="absolute inset-0 flex items-center justify-center text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-4">
          <span className="flex items-center gap-2 rounded-full bg-black/65 px-3 py-2 text-xs font-semibold">
            <Play className="h-4 w-4 fill-current" />{t(onPreview ? "enlarge" : "play")}
            {onPreview && <Maximize2 className="h-3.5 w-3.5" />}
          </span>
        </button>
      )}
      {loading && !error && (
        <div role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center text-white">
          <span className="flex items-center gap-2 rounded-full bg-black/75 px-3 py-2 text-xs">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />{t("loading")}
          </span>
        </div>
      )}
      {error && (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-3 text-center text-sm text-white">
          <p>{t("failed")}</p>
          <button type="button" onClick={onPreview ?? play} className="flex items-center gap-2 rounded-md border border-white/40 px-3 py-2">
            <RotateCcw className="h-4 w-4" />{t("retry")}
          </button>
        </div>
      )}
    </div>
  );
}
