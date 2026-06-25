"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, ImageIcon, RefreshCcw, Share2, Video, Volume2 } from "lucide-react";
import type { EntryIdentity, EntrySearchResponse } from "@/lib/search/entry-identity";
import { toast } from "sonner";
import { useState } from "react";
import { useTranslations } from "next-intl";

type EntrySearchSectionsProps = {
  result: EntrySearchResponse;
  isLoadingPrimary?: boolean;
  isLoadingSemantic?: boolean;
  isRefreshingSimilar?: boolean;
  isRefreshingRecommended?: boolean;
  onRefreshSimilar?: () => void;
  onRefreshRecommended?: () => void;
};

function displayCategory(entry: EntryIdentity): string {
  return (
    entry.category.secondary?.name ||
    entry.category.primary?.name ||
    entry.source.categoryDisplayName ||
    entry.source.categoryName
  );
}

function compactId(entryId: string): string {
  if (entryId.length <= 12) return entryId;
  return `${entryId.slice(0, 8)}...${entryId.slice(-4)}`;
}

function entryHref(entry: EntryIdentity): string {
  return entry.share.seoUrl;
}

async function copyText(value: string, successMessage: string) {
  await navigator.clipboard.writeText(value);
  toast.success(successMessage);
}

function playAudio(url: string, errorMessage: string) {
  const audio = new Audio(url);
  audio.play().catch(() => {
    toast.error(errorMessage);
  });
}

function MediaControls({
  entry,
  labels,
  compact = false,
}: {
  entry: EntryIdentity;
  labels: {
    audio: string;
    video: string;
    image: string;
    audioPlayFailed: string;
  };
  compact?: boolean;
}) {
  const { audioUrl, videoUrl, coverImage } = entry.assets;
  if (!audioUrl && !videoUrl && !coverImage) return null;

  const buttonClass = compact
    ? "h-7 rounded px-2 text-xs"
    : "h-8 rounded px-2.5 text-xs";
  const iconClass = compact ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {audioUrl && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={buttonClass}
          onClick={() => playAudio(audioUrl, labels.audioPlayFailed)}
        >
          <Volume2 className={`${iconClass} mr-1`} />
          {labels.audio}
        </Button>
      )}
      {videoUrl && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={buttonClass}
          asChild
        >
          <a href={videoUrl} target="_blank" rel="noopener noreferrer">
            <Video className={`${iconClass} mr-1`} />
            {labels.video}
          </a>
        </Button>
      )}
      {coverImage && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={buttonClass}
          asChild
        >
          <a href={coverImage} target="_blank" rel="noopener noreferrer">
            <ImageIcon className={`${iconClass} mr-1`} />
            {labels.image}
          </a>
        </Button>
      )}
    </div>
  );
}

function PrimaryMediaPreview({ entry }: { entry: EntryIdentity }) {
  const { audioUrl, videoUrl, coverImage } = entry.assets;
  if (!audioUrl && !videoUrl && !coverImage) return null;

  return (
    <div className="mb-4 space-y-3">
      {audioUrl && (
        <audio
          src={audioUrl}
          controls
          className="h-10 w-full max-w-2xl rounded-md"
        />
      )}

      {(coverImage || videoUrl) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {coverImage && (
            <Link
              href={entryHref(entry)}
              className="block overflow-hidden rounded-md border border-border bg-muted/30"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverImage}
                alt={entry.entryName}
                className="aspect-video w-full object-cover"
              />
            </Link>
          )}
          {videoUrl && (
            <video
              src={videoUrl}
              controls
              preload="metadata"
              poster={coverImage ?? undefined}
              className="aspect-video w-full rounded-md border border-border bg-muted/30 object-cover"
            />
          )}
        </div>
      )}
    </div>
  );
}

function TagList({ entry, limit = 6 }: { entry: EntryIdentity; limit?: number }) {
  const tags = [
    ...entry.tags.related.slice(0, 4),
    ...entry.tags.recommended.slice(0, 2),
  ].slice(0, limit);

  if (!tags.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <Badge key={`${tag.role}-${tag.id}`} variant="secondary" className="rounded">
          {tag.name}
        </Badge>
      ))}
    </div>
  );
}

function SharePreview({
  entry,
  open,
  labels,
  onOpenChange,
}: {
  entry: EntryIdentity | null;
  open: boolean;
  labels: {
    title: string;
    uniqueId: string;
    copyLink: string;
    openCard: string;
    copied: string;
    media: MediaLabels;
  };
  onOpenChange: (open: boolean) => void;
}) {
  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
        </DialogHeader>
        <div className="rounded-md border border-border p-4">
          <div className="mb-3 text-sm font-semibold">DimSum</div>
          <h3 className="mb-1 text-2xl font-semibold text-foreground">
            {entry.entryName}
          </h3>
          {entry.jyutping && (
            <p className="mb-2 text-sm text-muted-foreground">{entry.jyutping}</p>
          )}
          {entry.meaning && (
            <p className="mb-3 line-clamp-3 text-sm leading-6 text-foreground">
              {entry.meaning}
            </p>
          )}
          <MediaControls entry={entry} labels={labels.media} />
          <TagList entry={entry} />
          <p className="mt-4 font-mono text-xs text-muted-foreground">
            {labels.uniqueId}: {compactId(entry.entryId)}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => copyText(entry.share.seoUrl, labels.copied)}
          >
            {labels.copyLink}
          </Button>
          <Button type="button" asChild>
            <a href={entry.share.cardUrl} target="_blank" rel="noopener noreferrer">
              {labels.openCard}
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PrimaryEntry({
  entry,
  labels,
  onShare,
}: {
  entry: EntryIdentity;
  labels: {
    title: string;
    share: string;
    copied: string;
    media: MediaLabels;
  };
  onShare: (entry: EntryIdentity) => void;
}) {
  return (
    <section className="border-b border-border px-4 py-6 sm:px-0">
      <div className="max-w-4xl">
        <div className="mb-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{labels.title}</p>
            <div className="mt-2 flex items-start gap-2">
              <Link
                href={entryHref(entry)}
                className="min-w-0 break-words text-3xl font-semibold leading-tight text-foreground hover:underline"
              >
                {entry.entryName}
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-0.5 h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
                aria-label={labels.share}
                onClick={() => onShare(entry)}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {entry.jyutping && (
            <span className="font-medium text-muted-foreground/90">
              {entry.jyutping}
            </span>
          )}
          <span className="text-muted-foreground/80">{displayCategory(entry)}</span>
          <button
            type="button"
            onClick={() => copyText(entry.entryId, labels.copied)}
            className="inline-flex max-w-full items-center gap-1 rounded border border-border/60 px-1.5 py-0.5 font-mono text-xs text-muted-foreground/70 hover:border-border hover:bg-muted hover:text-muted-foreground"
          >
            <span className="truncate">{compactId(entry.entryId)}</span>
            <Copy className="h-3 w-3 shrink-0" />
          </button>
        </div>

        {entry.meaning && (
          <p className="mb-4 max-w-3xl text-sm leading-6 text-foreground">
            {entry.meaning}
          </p>
        )}

        <PrimaryMediaPreview entry={entry} />
        <TagList entry={entry} />
      </div>
    </section>
  );
}

function PrimaryLoading() {
  return (
    <section className="border-b border-border px-4 py-5 sm:px-0">
      <div className="max-w-4xl">
        <div className="mb-3 h-3 w-24 rounded bg-muted" />
        <div className="mb-3 h-8 w-36 rounded bg-muted" />
        <div className="mb-3 h-4 w-2/3 rounded bg-muted" />
        <div className="h-16 w-full rounded bg-muted" />
      </div>
    </section>
  );
}

function EmptyPrimary({ text }: { text: string }) {
  return (
    <section className="border-b border-border px-4 py-5 sm:px-0">
      <div className="max-w-4xl text-sm text-muted-foreground">
        {text}
      </div>
    </section>
  );
}

function EntryTile({
  entry,
  labels,
  dense = false,
}: {
  entry: EntryIdentity;
  labels: {
    copied: string;
    media: MediaLabels;
  };
  dense?: boolean;
}) {
  return (
    <article className="flex min-h-[168px] flex-col rounded-md border border-border bg-background p-4 transition-colors hover:bg-muted/30">
      <Link href={entryHref(entry)} className="group mb-3 block min-w-0">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 min-w-0 break-words text-base font-semibold leading-snug text-foreground group-hover:underline">
            {entry.entryName}
          </h3>
          <span className="shrink-0 text-xs text-muted-foreground">
            {displayCategory(entry)}
          </span>
        </div>
        {entry.jyutping && (
          <p className="mb-2 text-sm text-muted-foreground">{entry.jyutping}</p>
        )}
        {entry.meaning && (
          <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
            {entry.meaning}
          </p>
        )}
      </Link>
      <div className="mt-auto space-y-2">
        <MediaControls entry={entry} labels={labels.media} compact />
        <TagList entry={entry} limit={dense ? 4 : 5} />
        <button
          type="button"
          onClick={() => copyText(entry.entryId, labels.copied)}
          className="inline-flex max-w-full items-center gap-1 self-start rounded border border-border px-1.5 py-0.5 font-mono text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <span className="truncate">{compactId(entry.entryId)}</span>
          <Copy className="h-3 w-3 shrink-0" />
        </button>
      </div>
    </article>
  );
}

function ResultSection({
  title,
  entries,
  refreshLabel,
  emptyLabel,
  labels,
  isRefreshing,
  onRefresh,
  columns = 3,
  dense = false,
}: {
  title: string;
  entries: EntryIdentity[];
  refreshLabel: string;
  emptyLabel: string;
  labels: {
    copied: string;
    media: MediaLabels;
  };
  isRefreshing?: boolean;
  onRefresh?: () => void;
  columns?: 3 | 4;
  dense?: boolean;
}) {
  const gridClass = columns === 4 ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-4" : "grid gap-3 sm:grid-cols-3";

  return (
    <section className="border-b border-border px-4 py-6 sm:px-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {onRefresh && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCcw className="mr-1.5 h-4 w-4" />
            {refreshLabel}
          </Button>
        )}
      </div>
      {isRefreshing && !entries.length ? (
        <div className={gridClass}>
          {Array.from({ length: columns }).map((_, index) => (
            <div key={index} className="rounded-md border border-border p-3">
              <div className="mb-2 h-4 w-2/3 rounded bg-muted" />
              <div className="mb-2 h-3 w-1/2 rounded bg-muted" />
              <div className="h-10 w-full rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : entries.length ? (
        <div className={gridClass}>
          {entries.map((entry) => (
            <EntryTile
              key={entry.entryId}
              entry={entry}
              labels={labels}
              dense={dense}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </section>
  );
}

type MediaLabels = {
  audio: string;
  video: string;
  image: string;
  audioPlayFailed: string;
};

export function EntrySearchSections({
  result,
  isLoadingPrimary,
  isLoadingSemantic,
  isRefreshingSimilar,
  isRefreshingRecommended,
  onRefreshSimilar,
  onRefreshRecommended,
}: EntrySearchSectionsProps) {
  const t = useTranslations("EntrySearch");
  const [shareEntry, setShareEntry] = useState<EntryIdentity | null>(null);
  const mediaLabels: MediaLabels = {
    audio: t("audio"),
    video: t("video"),
    image: t("image"),
    audioPlayFailed: t("audioPlayFailed"),
  };
  const commonLabels = {
    copied: t("copied"),
    media: mediaLabels,
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      {isLoadingPrimary ? (
        <PrimaryLoading />
      ) : result.primary ? (
        <PrimaryEntry
          entry={result.primary}
          labels={{
            title: t("primaryTitle"),
            share: t("share"),
            copied: t("copied"),
            media: mediaLabels,
          }}
          onShare={setShareEntry}
        />
      ) : (
        <EmptyPrimary text={t("emptyPrimary")} />
      )}
      <ResultSection
        title={t("similarTitle")}
        entries={result.similar}
        refreshLabel={t("refresh")}
        emptyLabel={t("emptyResults")}
        labels={commonLabels}
        isRefreshing={isLoadingSemantic || isRefreshingSimilar}
        onRefresh={result.cursors.similarNext ? onRefreshSimilar : undefined}
      />
      <ResultSection
        title={t("recommendedTitle")}
        entries={result.recommended}
        refreshLabel={t("refresh")}
        emptyLabel={t("emptyResults")}
        labels={commonLabels}
        isRefreshing={isLoadingSemantic || isRefreshingRecommended}
        onRefresh={result.cursors.recommendedNext ? onRefreshRecommended : undefined}
        columns={4}
        dense
      />
      <SharePreview
        entry={shareEntry}
        open={Boolean(shareEntry)}
        labels={{
          title: t("sharePreviewTitle"),
          uniqueId: t("uniqueId"),
          copyLink: t("copyLink"),
          openCard: t("openCard"),
          copied: t("copied"),
          media: mediaLabels,
        }}
        onOpenChange={(open) => {
          if (!open) setShareEntry(null);
        }}
      />
    </div>
  );
}
