"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Pause, Volume2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { EntryIdentity } from "@/lib/search/entry-identity";
import { displayCategory, entryHref, primaryJyutping } from "@/lib/search/entry-display";
import { cn } from "@/lib/utils";

// 同一时间只播放一条读音
let activeAudio: HTMLAudioElement | null = null;

function useAudio(url: string) {
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

  return { playing, toggle };
}

/** 圆形播放按钮。prominent 用于主卡片，其余为浅色小按钮。 */
export function AudioButton({
  url,
  prominent = false,
  className,
}: {
  url: string;
  prominent?: boolean;
  className?: string;
}) {
  const t = useTranslations("Assistant");
  const { playing, toggle } = useAudio(url);
  const Icon = playing ? Pause : Volume2;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("playAudio")}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full transition-colors",
        prominent
          ? "size-11 bg-primary text-primary-foreground hover:bg-primary/90"
          : "size-8 bg-primary/10 text-primary hover:bg-primary/20",
        className,
      )}
    >
      <Icon className={prominent ? "size-5" : "size-4"} />
    </button>
  );
}

function JyutpingPill({ value }: { value: string }) {
  return (
    <span className="inline-block rounded-xl bg-primary/10 px-3 py-1 font-mono text-sm leading-6 text-primary">
      {value}
    </span>
  );
}

/** 主词条卡：大字、粤拼标签、醒目的播放按钮。 */
export function WordCard({ entry }: { entry: EntryIdentity }) {
  const t = useTranslations("Assistant");
  const jyutping = primaryJyutping(entry);
  return (
    <div className="rounded-2xl bg-muted/40 p-5">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "font-semibold leading-tight tracking-tight break-words",
              // 整句语料用小一号字，单字词保持醒目
              entry.entryName.length > 8 ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl",
            )}
          >
            {entry.entryName}
          </div>
          {jyutping && (
            <div className="mt-2.5">
              <JyutpingPill value={jyutping} />
            </div>
          )}
        </div>
        {entry.assets.audioUrl && <AudioButton url={entry.assets.audioUrl} prominent />}
      </div>
      {entry.meaning && (
        <p className="mt-4 text-[15px] leading-7 whitespace-pre-line text-muted-foreground line-clamp-6">
          {entry.meaning}
        </p>
      )}
      <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{displayCategory(entry)}</span>
        <a
          href={entryHref(entry)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-0.5 hover:text-foreground"
        >
          {t("viewEntry")}
          <ArrowUpRight className="size-3.5" />
        </a>
      </div>
    </div>
  );
}

/** 列表行：用于例句和检索结果，悬停高亮，不加边框。 */
export function EntryRow({ entry }: { entry: EntryIdentity }) {
  const t = useTranslations("Assistant");
  const jyutping = primaryJyutping(entry);
  return (
    <div className="group flex items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-background">
      {entry.assets.audioUrl ? (
        <AudioButton url={entry.assets.audioUrl} className="mt-0.5" />
      ) : (
        <span className="mt-0.5 size-8 shrink-0" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium leading-6 break-words">{entry.entryName}</div>
        {jyutping && <div className="font-mono text-xs leading-5 text-primary/80">{jyutping}</div>}
        {entry.meaning && (
          <div className="mt-0.5 text-sm leading-6 text-muted-foreground line-clamp-2">{entry.meaning}</div>
        )}
      </div>
      <a
        href={entryHref(entry)}
        target="_blank"
        rel="noreferrer"
        aria-label={t("viewEntry")}
        title={t("viewEntry")}
        className="mt-1 shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus:opacity-100"
      >
        <ArrowUpRight className="size-4" />
      </a>
    </div>
  );
}
