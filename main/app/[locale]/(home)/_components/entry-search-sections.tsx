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
import { getCorpusItemByUniqueId, type SearchResult } from "@/lib/api/search";
import type { EntryIdentity, EntrySearchResponse } from "@/lib/search/entry-identity";
import { toast } from "sonner";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { AnimatePresence, motion } from "motion/react";

type EntrySearchSectionsProps = {
  result: EntrySearchResponse;
  isLoadingPrimary?: boolean;
  isLoadingSimilar?: boolean;
  isLoadingRecommended?: boolean;
  isRefreshingSimilar?: boolean;
  isRefreshingRecommended?: boolean;
  onRefreshSimilar?: () => void;
  onRefreshRecommended?: () => void;
  setEditingResult?: React.Dispatch<React.SetStateAction<SearchResult | null>>;
  setUpdateDialogOpen?: React.Dispatch<React.SetStateAction<boolean>>;
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

function canEditEntry(entry: EntryIdentity, user: { role?: string } | null | undefined) {
  if (!user) return false;
  if (entry.editableLevel === 0) return false;
  if (entry.editableLevel === 1) {
    return user.role === "TAGGER_PARTNER" || user.role === "TAGGER_OUTSOURCING";
  }
  return true;
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
    <div className="space-y-3">
      {audioUrl && (
        <audio src={audioUrl} controls className="h-10 w-full max-w-3xl" />
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

function TagList({
  entry,
  relatedLimit = 4,
}: {
  entry: EntryIdentity;
  relatedLimit?: number;
}) {
  const relatedTags = entry.tags.related.slice(0, relatedLimit);

  if (!relatedTags.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {relatedTags.map((tag) => (
        <Badge
          key={`${tag.role}-${tag.id}`}
          variant="secondary"
          className="rounded-md border border-primary/15 bg-primary/10 font-medium text-primary"
        >
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
  canEdit,
  isEditLoading,
  onEdit,
  onShare,
}: {
  entry: EntryIdentity;
  labels: {
    title: string;
    share: string;
    edit: string;
    editing: string;
    copied: string;
    media: MediaLabels;
  };
  canEdit: boolean;
  isEditLoading: boolean;
  onEdit?: (entry: EntryIdentity) => void;
  onShare: (entry: EntryIdentity) => void;
}) {
  const hasMetadata = Boolean(entry.jyutping || displayCategory(entry));

  return (
    <section className="border-b border-border/60 px-4 py-8 sm:px-0">
      <div className="max-w-5xl">
        <div className="mb-4 flex items-center gap-2">
          <span className="h-5 w-1 rounded-full bg-primary/70" />
          <p className="text-sm font-semibold text-primary">{labels.title}</p>
        </div>

        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <Link
            href={entryHref(entry)}
            className="min-w-0 max-w-5xl break-words text-3xl font-semibold leading-tight text-foreground transition-colors hover:text-primary sm:text-4xl"
          >
            {entry.entryName}
          </Link>
          <div className="mt-1 flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
              aria-label={labels.share}
              onClick={() => onShare(entry)}
            >
              <Share2 className="h-4 w-4" />
            </Button>
            {canEdit && onEdit && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-md px-2 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                disabled={isEditLoading}
                onClick={() => onEdit(entry)}
              >
                {isEditLoading ? labels.editing : labels.edit}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-3 text-sm text-muted-foreground">
          {hasMetadata && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {entry.jyutping && (
                <span className="font-medium leading-6 text-muted-foreground/90">
                  {entry.jyutping}
                </span>
              )}
              <span className="text-muted-foreground/75">
                {displayCategory(entry)}
              </span>
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-5">
          {entry.meaning && (
            <p className="max-w-3xl text-base leading-8 text-foreground">
              {entry.meaning}
            </p>
          )}

          <PrimaryMediaPreview entry={entry} />

          {entry.tags.related.length > 0 && (
            <TagList entry={entry} relatedLimit={4} />
          )}

          <button
            type="button"
            onClick={() => copyText(entry.entryId, labels.copied)}
            className="group/id inline-flex max-w-full items-center gap-1 self-start font-mono text-xs text-muted-foreground/55 transition-colors hover:text-primary"
          >
            <span className="break-all">{entry.entryId}</span>
            <Copy className="h-3 w-3 shrink-0 opacity-60 group-hover/id:opacity-100" />
          </button>
        </div>
      </div>
    </section>
  );
}

function PrimaryLoading() {
  return (
    <section className="border-b border-border/60 px-4 py-8 sm:px-0">
      <div className="max-w-5xl animate-pulse">
        <div className="mb-5 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-primary/30" />
          <div className="h-4 w-24 rounded bg-muted" />
        </div>
        <div className="space-y-3">
          <div className="h-10 w-4/5 max-w-3xl rounded bg-muted sm:h-12" />
          <div className="h-10 w-1/2 max-w-xl rounded bg-muted sm:h-12" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <div className="h-4 w-56 rounded bg-muted" />
          <div className="h-4 w-20 rounded bg-muted" />
        </div>
        <div className="mt-7 space-y-3">
          <div className="h-4 w-full max-w-2xl rounded bg-muted" />
          <div className="h-4 w-3/5 max-w-xl rounded bg-muted" />
        </div>
        <div className="mt-6 h-10 w-full max-w-3xl rounded-full bg-muted" />
        <div className="mt-5 flex gap-2">
          <div className="h-7 w-16 rounded-md bg-muted" />
          <div className="h-7 w-20 rounded-md bg-muted" />
          <div className="h-7 w-14 rounded-md bg-muted" />
        </div>
      </div>
    </section>
  );
}

function EmptyPrimary({ text }: { text: string }) {
  return (
    <section className="border-b border-border/60 px-4 py-5 sm:px-0">
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
    media: MediaLabels;
  };
  dense?: boolean;
}) {
  return (
    <article className="group flex min-h-[196px] flex-col rounded-lg border border-border/80 bg-background p-4 shadow-sm shadow-black/5 transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md hover:shadow-black/10">
      <Link href={entryHref(entry)} className="mb-4 block min-w-0">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          {displayCategory(entry)}
        </div>
        <h3 className="line-clamp-2 min-w-0 break-words text-lg font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
          {entry.entryName}
        </h3>
        {entry.jyutping && (
          <p className="mt-2 line-clamp-2 text-sm font-medium leading-5 text-muted-foreground">
            {entry.jyutping}
          </p>
        )}
        {entry.meaning && (
          <p className="mt-3 line-clamp-2 border-l-2 border-border pl-3 text-sm leading-6 text-muted-foreground">
            {entry.meaning}
          </p>
        )}
      </Link>
      <div className="mt-auto space-y-3">
        <MediaControls entry={entry} labels={labels.media} compact />
        <TagList
          entry={entry}
          relatedLimit={dense ? 3 : 4}
        />
      </div>
    </article>
  );
}

function EntryTileSkeleton({ dense = false }: { dense?: boolean }) {
  return (
    <article className="flex min-h-[196px] flex-col rounded-lg border border-border/80 bg-background p-4 shadow-sm shadow-black/5">
      <div className="animate-pulse">
        <div className="mb-4 h-3 w-20 rounded bg-muted" />
        <div className="mb-2 h-5 w-4/5 rounded bg-muted" />
        <div className="mb-4 h-5 w-2/3 rounded bg-muted" />
        <div className="mb-2 h-4 w-3/5 rounded bg-muted" />
        <div className="mb-5 h-4 w-1/2 rounded bg-muted" />
        <div className="mb-5 space-y-2 border-l-2 border-border pl-3">
          <div className="h-3 w-full rounded bg-muted" />
          <div className="h-3 w-3/4 rounded bg-muted" />
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          {Array.from({ length: dense ? 3 : 4 }).map((_, index) => (
            <div
              key={index}
              className="h-7 rounded-md bg-muted"
              style={{ width: `${index % 2 === 0 ? 52 : 72}px` }}
            />
          ))}
        </div>
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
    media: MediaLabels;
  };
  isRefreshing?: boolean;
  onRefresh?: () => void;
  columns?: 3 | 4;
  dense?: boolean;
}) {
  const gridClass =
    columns === 4
      ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      : "grid gap-4 sm:grid-cols-3";
  const entriesKey = entries.map((entry) => entry.entryId).join("|") || "empty";

  return (
    <section className="px-4 py-7 sm:px-0">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {onRefresh && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCcw
              className={`mr-1.5 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            {refreshLabel}
          </Button>
        )}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {isRefreshing && !entries.length ? (
          <motion.div
            key="loading"
            className={gridClass}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {Array.from({ length: columns }).map((_, index) => (
              <EntryTileSkeleton key={index} dense={dense} />
            ))}
          </motion.div>
        ) : entries.length ? (
          <motion.div
            key={entriesKey}
            className={gridClass}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {entries.map((entry) => (
              <EntryTile
                key={entry.entryId}
                entry={entry}
                labels={labels}
                dense={dense}
              />
            ))}
          </motion.div>
        ) : (
          <motion.p
            key="empty"
            className="text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            {emptyLabel}
          </motion.p>
        )}
      </AnimatePresence>
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
  isLoadingSimilar,
  isLoadingRecommended,
  isRefreshingSimilar,
  isRefreshingRecommended,
  onRefreshSimilar,
  onRefreshRecommended,
  setEditingResult,
  setUpdateDialogOpen,
}: EntrySearchSectionsProps) {
  const t = useTranslations("EntrySearch");
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [shareEntry, setShareEntry] = useState<EntryIdentity | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const mediaLabels: MediaLabels = {
    audio: t("audio"),
    video: t("video"),
    image: t("image"),
    audioPlayFailed: t("audioPlayFailed"),
  };
  const commonLabels = {
    media: mediaLabels,
  };
  const handleEditEntry =
    setEditingResult && setUpdateDialogOpen
      ? async (entry: EntryIdentity) => {
          setEditingEntryId(entry.entryId);
          try {
            const result = await getCorpusItemByUniqueId(entry.entryId, queryClient);
            if (!result) {
              toast.error(t("editLoadFailed"));
              return;
            }
            setEditingResult(result);
            setUpdateDialogOpen(true);
          } catch {
            toast.error(t("editLoadFailed"));
          } finally {
            setEditingEntryId(null);
          }
        }
      : undefined;

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
            edit: t("edit"),
            editing: t("editing"),
            copied: t("copied"),
            media: mediaLabels,
          }}
          canEdit={canEditEntry(result.primary, user)}
          isEditLoading={editingEntryId === result.primary.entryId}
          onEdit={handleEditEntry}
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
        isRefreshing={isLoadingSimilar || isRefreshingSimilar}
        onRefresh={result.cursors.similarNext ? onRefreshSimilar : undefined}
      />
      <ResultSection
        title={t("recommendedTitle")}
        entries={result.recommended}
        refreshLabel={t("refresh")}
        emptyLabel={t("emptyResults")}
        labels={commonLabels}
        isRefreshing={isLoadingRecommended || isRefreshingRecommended}
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
