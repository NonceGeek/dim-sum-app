"use client";

import { Maximize, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type WebkitVideoElement = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
};

type CardVideoPreviewProps = {
  url: string;
  poster?: string | null;
  fullscreenLabel: string;
  playFailedLabel: string;
};

export function CardVideoPreview({
  url,
  poster,
  fullscreenLabel,
  playFailedLabel,
}: CardVideoPreviewProps) {
  const videoRef = useRef<WebkitVideoElement>(null);
  const [inlineFallback, setInlineFallback] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleFullscreenExit = () => {
      if (!document.fullscreenElement && !inlineFallback) video.pause();
    };
    const handleWebkitExit = () => video.pause();

    document.addEventListener("fullscreenchange", handleFullscreenExit);
    video.addEventListener("webkitendfullscreen", handleWebkitExit);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenExit);
      video.removeEventListener("webkitendfullscreen", handleWebkitExit);
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, []);

  const playFullscreen = async () => {
    const video = videoRef.current;
    if (!video) return;

    setError(false);
    if (!video.src) video.src = url;

    try {
      if (video.webkitEnterFullscreen) {
        await video.play();
        video.webkitEnterFullscreen();
        return;
      }

      if (video.requestFullscreen) {
        await video.requestFullscreen();
        await video.play();
        return;
      }

      setInlineFallback(true);
      await video.play();
    } catch {
      setInlineFallback(true);
      setError(true);
    }
  };

  return (
    <div className="relative h-24 overflow-hidden rounded-md border border-border bg-slate-950">
      <video
        ref={videoRef}
        controls={inlineFallback}
        playsInline
        preload="none"
        poster={poster ?? undefined}
        onError={() => setError(true)}
        className={
          inlineFallback
            ? "absolute inset-0 z-20 h-full w-full bg-black object-contain"
            : "pointer-events-none absolute inset-0 h-full w-full bg-black object-contain opacity-0"
        }
      />

      {!inlineFallback && (
        <button
          type="button"
          onClick={playFullscreen}
          className="absolute inset-0 flex items-center justify-center overflow-hidden text-white"
          aria-label={fullscreenLabel}
        >
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-70"
            />
          )}
          <span className="relative flex items-center gap-2 rounded-full bg-black/65 px-3 py-2 text-xs font-semibold shadow-sm">
            <Play className="h-4 w-4 fill-current" />
            {fullscreenLabel}
            <Maximize className="h-3.5 w-3.5" />
          </span>
        </button>
      )}

      {error && !inlineFallback && (
        <span className="absolute inset-x-2 bottom-2 text-center text-xs text-white/80">
          {playFailedLabel}
        </span>
      )}
    </div>
  );
}
