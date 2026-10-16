"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Pause, Volume2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EntryIdentity } from "@/lib/search/entry-identity";
import { displayCategory, entryHref, primaryJyutping } from "@/lib/search/entry-display";
import { cn } from "@/lib/utils";

// 同一时间只播放一条读音
let activeAudio: HTMLAudioElement | null = null;

export function AudioButton({ url, className }: { url: string; className?: string }) {
  const t = useTranslations("Assistant");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => () => audioRef.current?.pause(), []);

  const toggle = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.addEventListener("ended", () => setPlaying(false));
      audioRef.current.addEventListener("pause", () => setPlaying(false));
    }
    const audio = audioRef.current;
    if (playing) {
      audio.pause();
      return;
    }
    if (activeAudio && activeAudio !== audio) activeAudio.pause();
    activeAudio = audio;
    audio.currentTime = 0;
    void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8 shrink-0", className)}
      onClick={toggle}
      aria-label={t("playAudio")}
    >
      {playing ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </Button>
  );
}

/** 词条卡片。compact 用于列表与表格，完整版用于 word_card。 */
export function EntryCard({
  entry,
  compact = false,
  className,
}: {
  entry: EntryIdentity;
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("Assistant");
  const jyutping = primaryJyutping(entry);

  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground",
        compact ? "p-3" : "p-4",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className={cn("font-semibold break-words", compact ? "text-base" : "text-2xl")}>
              {entry.entryName}
            </span>
            {jyutping && (
              <span className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
                {jyutping}
              </span>
            )}
          </div>
          {entry.meaning && (
            <p
              className={cn(
                "mt-1 text-muted-foreground whitespace-pre-line break-words",
                compact ? "text-sm line-clamp-2" : "text-sm line-clamp-6",
              )}
            >
              {entry.meaning}
            </p>
          )}
        </div>
        {entry.assets.audioUrl && <AudioButton url={entry.assets.audioUrl} />}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <Badge variant="secondary" className="max-w-[70%] truncate font-normal">
          {displayCategory(entry)}
        </Badge>
        <a
          href={entryHref(entry)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {t("viewEntry")}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
