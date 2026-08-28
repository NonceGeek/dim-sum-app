"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Box,
  Copy,
  ImageIcon,
  RefreshCcw,
  Share2,
  Video,
  Volume2,
} from "lucide-react";
import { Model3dCard } from "@/components/media/model3d-card";
import { VideoCard } from "@/components/media/video-card";
import { getCorpusItemByUniqueId, type SearchResult } from "@/lib/api/search";
import type { EntryIdentity, EntrySearchResponse } from "@/lib/search/entry-identity";
import { toast } from "sonner";
import { Fragment, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { AnimatePresence, motion } from "motion/react";
import { useTheme } from "next-themes";
import domtoimage from "dom-to-image";
import { cn } from "@/lib/utils";

type EntrySearchSectionsProps = {
  result: EntrySearchResponse;
  primaryDatasetLabel?: string;
  isLoadingPrimary?: boolean;
  isLoadingSimilar?: boolean;
  isLoadingRecommended?: boolean;
  isRefreshingSimilar?: boolean;
  isRefreshingRecommended?: boolean;
  onRefreshSimilar?: () => void;
  onRefreshRecommended?: () => void;
  mediaType?: SearchMediaFilter;
  onMediaTypeChange?: (mediaType?: SearchMediaFilter) => void;
  setEditingResult?: React.Dispatch<React.SetStateAction<SearchResult | null>>;
  setUpdateDialogOpen?: React.Dispatch<React.SetStateAction<boolean>>;
};

type SearchMediaFilter = "text" | "audio" | "video" | "image" | "model3d";

function displayCategory(entry: EntryIdentity): string {
  return (
    entry.category.primary?.name ||
    entry.category.secondary?.name ||
    entry.source.categoryDisplayName ||
    entry.source.categoryName
  );
}

function displaySource(entry: EntryIdentity): string {
  return entry.source.categoryDisplayName || entry.source.categoryName;
}

function compactId(entryId: string): string {
  if (entryId.length <= 12) return entryId;
  return `${entryId.slice(0, 8)}...${entryId.slice(-4)}`;
}

function entryHref(entry: EntryIdentity, returnQuery?: string): string {
  const query = returnQuery?.trim();
  if (!query) return entry.share.seoUrl;

  const params = new URLSearchParams({ fromSearch: query });
  return `${entry.share.seoUrl}?${params.toString()}`;
}

function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (typeof window === "undefined") return pathOrUrl;
  return new URL(pathOrUrl, window.location.origin).toString();
}

type SharePronunciation = {
  jyutping: string | null;
  singer: string | null;
  meaning: string | null;
  introduction: string | null;
  emotion: string | null;
  emotionIntensity: string | null;
  other: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function blockText(blocks: Record<string, unknown>[], type: string): string | null {
  const values = blocks
    .filter((block) => block.type === type)
    .map((block) => block.content)
    .filter(
      (content): content is string =>
        typeof content === "string" && content.trim().length > 0,
    )
    .map((content) => content.trim());

  return values.length ? values.join("\n") : null;
}

function contextText(context: Record<string, unknown> | null, keys: string[]): string | null {
  if (!context) return null;

  for (const key of keys) {
    const value = context[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value)) {
      const text = value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
        .join("、");
      if (text) return text;
    }
  }

  return null;
}

function getNoteContext(note: unknown): Record<string, unknown> | null {
  if (!isRecord(note) || !isRecord(note.context)) return null;
  return note.context;
}

function structuredJyutping(structuredNote: unknown): string | null {
  if (!isRecord(structuredNote) || !Array.isArray(structuredNote.data)) return null;

  const values = structuredNote.data
    .filter(isRecord)
    .map((item) => item.jyutping)
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());
  const uniqueValues = Array.from(new Set(values));

  return uniqueValues.length ? uniqueValues.join(" / ") : null;
}

function primaryJyutping(entry: EntryIdentity): string | null {
  return (
    structuredJyutping(entry.raw.structuredNote) ||
    contextText(getNoteContext(entry.raw.note), ["pinyin", "song_name_pin"]) ||
    entry.jyutping
  );
}

function getSharePronunciations(entry: EntryIdentity): SharePronunciation[] {
  const structuredNote = entry.raw.structuredNote;
  if (isRecord(structuredNote) && Array.isArray(structuredNote.data)) {
    const pronunciations = structuredNote.data
      .filter(isRecord)
      .map((item) => {
        const jyutping =
          typeof item.jyutping === "string" && item.jyutping.trim()
            ? item.jyutping.trim()
            : null;
        const blocks = (Array.isArray(item.blocks) ? item.blocks : []).filter(isRecord);
        const meaning = blockText(blocks, "definition");
        const introduction = blockText(blocks, "introduction");
        const other = blockText(blocks, "other");
        const emotionBlock = blocks.find((block) => block.type === "emotion");
        const emotion =
          typeof emotionBlock?.category === "string" && emotionBlock.category.trim()
            ? emotionBlock.category.trim()
            : blockText(blocks, "emotion");
        const emotionIntensity =
          typeof emotionBlock?.intensity === "string" && emotionBlock.intensity.trim()
            ? emotionBlock.intensity.trim()
            : null;

        return jyutping || meaning || introduction || emotion || emotionIntensity || other
          ? {
              jyutping,
              singer: null,
              meaning,
              introduction,
              emotion,
              emotionIntensity,
              other,
            }
          : null;
      })
      .filter((item): item is SharePronunciation => item !== null);

    if (pronunciations.length) return pronunciations;
  }

  const noteContext = getNoteContext(entry.raw.note);
  const noteJyutping = contextText(noteContext, [
    "song_name_pin",
    "pinyin",
    "jyutping",
  ]);
  const singer = contextText(noteContext, ["author"]);
  const meaning = contextText(noteContext, [
    "meaning",
    "definition",
  ]);
  const introduction = contextText(noteContext, ["introduction"]);
  if (noteJyutping || singer || meaning || introduction) {
    return [
      {
        jyutping: noteJyutping,
        singer,
        meaning,
        introduction,
        emotion: null,
        emotionIntensity: null,
        other: null,
      },
    ];
  }

  if (entry.jyutping || entry.meaning) {
    return [
      {
        jyutping: entry.jyutping,
        singer: null,
        meaning: entry.meaning,
        introduction: null,
        emotion: null,
        emotionIntensity: null,
        other: null,
      },
    ];
  }

  return [];
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
  returnQuery,
}: {
  entry: EntryIdentity;
  labels: {
    audio: string;
    video: string;
    image: string;
    model3d: string;
    audioPlayFailed: string;
  };
  compact?: boolean;
  returnQuery?: string;
}) {
  const { audioUrl, videoUrl, coverImage, model3dUrl } = entry.assets;
  if (!audioUrl && !videoUrl && !coverImage && !model3dUrl) return null;

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
          <Link href={entryHref(entry, returnQuery)}>
            <Video className={`${iconClass} mr-1`} />
            {labels.video}
          </Link>
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
      {model3dUrl && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={buttonClass}
          asChild
        >
          <a href={model3dUrl} target="_blank" rel="noopener noreferrer">
            <Box className={`${iconClass} mr-1`} />
            {labels.model3d}
          </a>
        </Button>
      )}
    </div>
  );
}

function PrimaryMediaPreview({
  entry,
  labels,
  returnQuery,
}: {
  entry: EntryIdentity;
  labels: MediaLabels;
  returnQuery?: string;
}) {
  const { audioUrl, videoUrl, videoTranscript, coverImage, model3dUrl } =
    entry.assets;
  if (!audioUrl && !videoUrl && !coverImage && !model3dUrl) return null;

  return (
    <div className="space-y-3">
      {audioUrl && (
        <audio src={audioUrl} controls className="h-10 w-full max-w-3xl" />
      )}

      {(coverImage || videoUrl) && (
        <div
          className={cn(
            "grid gap-3",
            coverImage && videoUrl && "sm:grid-cols-2",
          )}
        >
          {coverImage && (
            <Link
              href={entryHref(entry, returnQuery)}
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
            <VideoCard
              url={videoUrl}
              poster={coverImage}
              transcript={videoTranscript}
              transcriptLabel={labels.videoTranscript}
              openSourceLabel={labels.openVideoSource}
            />
          )}
        </div>
      )}

      {model3dUrl && (
        <Model3dCard
          url={model3dUrl}
          entryName={entry.entryName}
          modelLabel={labels.model3d}
          openLabel={labels.openModel3d}
        />
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

function RecommendedTagList({
  entry,
  limit = 6,
}: {
  entry: EntryIdentity;
  limit?: number;
}) {
  const recommendedTags = entry.tags.recommended.slice(0, limit);

  if (!recommendedTags.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {recommendedTags.map((tag) => (
        <Badge
          key={`${tag.role}-${tag.id}`}
          variant="secondary"
          className="rounded-md border border-border bg-muted/60 font-medium text-muted-foreground"
        >
          {tag.name}
        </Badge>
      ))}
    </div>
  );
}

function ShareMetaRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-4 text-sm leading-6 sm:grid-cols-[6.75rem_1fr] sm:gap-5">
      <dt className="font-semibold text-foreground">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </div>
  );
}

function PrimaryIdentityInfo({
  entry,
  labels,
}: {
  entry: EntryIdentity;
  labels: {
    source: string;
    primaryCategory: string;
    secondaryCategory: string;
    contributors: string;
  };
}) {
  const contributorId = entry.source.contributorIds.find(Boolean);
  const items = [
    {
      label: labels.source,
      value: displaySource(entry),
    },
    {
      label: labels.primaryCategory,
      value: entry.category.primary?.name ?? null,
    },
    {
      label: labels.secondaryCategory,
      value: entry.category.secondary?.name ?? null,
    },
    {
      label: labels.contributors,
      value: contributorId ?? null,
      mono: Boolean(contributorId),
    },
  ].filter((item) => item.value);

  if (!items.length) return null;

  return (
    <dl className="grid max-w-3xl gap-x-6 gap-y-3 rounded-lg border border-border/70 bg-muted/20 p-4 text-sm sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">
            {item.label}
          </dt>
          <dd
            className={`mt-1 min-w-0 break-words font-medium text-foreground ${
              item.mono ? "font-mono text-xs" : ""
            }`}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
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
    downloadImage: string;
    downloadImageFailed: string;
    copyLink: string;
    openCard: string;
    copied: string;

    jyutping: string;
    singer: string;
    meaning: string;
    introduction: string;
    source: string;
    category: string;
    keyTags: string;
    recommendedTags: string;
    media: MediaLabels;
    tags: string;
    contributors: string;
    emotion: string;
    emotionIntensity: string;
    other: string;
  };
  onOpenChange: (open: boolean) => void;
}) {
  const { theme } = useTheme();
  const previewRef = useRef<HTMLDivElement>(null);

  if (!entry) return null;

  const sourceName =
    entry.source.categoryDisplayName || entry.source.categoryName;
  const categoryName = [entry.category.primary?.name, entry.category.secondary?.name].filter(Boolean).join(" / ");
  const shareUrl = absoluteUrl(entry.share.seoUrl);
  const hasTags =
    entry.tags.related.length > 0 || entry.tags.recommended.length > 0;
  const contributorId = entry.source.contributorIds.filter(Boolean).join(", ");
  const pronunciations = getSharePronunciations(entry);
  async function handleDownloadImage() {
    if (!previewRef.current || !entry) return;

    try {
      const dataUrl = await domtoimage.toPng(previewRef.current, {
        quality: 1,
        cacheBust: true,
        bgcolor: theme === "dark" ? "#020817" : "#ffffff",
        width: previewRef.current.offsetWidth * 2,
        height: previewRef.current.offsetHeight * 2,
        style: {
          transform: "scale(2)",
          transformOrigin: "top left",
        },
      });
      const link = document.createElement("a");
      link.download = `dimsum-${entry.entryName}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Failed to generate share preview image:", error);
      toast.error(labels.downloadImageFailed);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] gap-0 overflow-y-auto p-0 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="px-4 pt-5 pr-10 text-xl font-semibold sm:px-7 sm:pt-7 sm:text-2xl">
            {labels.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {entry.entryName}
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 pt-3 pb-4 sm:px-7 sm:pt-4 sm:pb-6">
          <div
            ref={previewRef}
            className="rounded-lg border border-primary/45 bg-background p-4 shadow-[0_10px_30px_color-mix(in_srgb,var(--primary)_16%,transparent)] sm:p-6"
          >
            <div className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground sm:mb-5 sm:text-lg">
              <img
                src="/logo.png"
                alt="DimSum"
                className="h-6 w-6 rounded-full"
              />
              <span>DimSum</span>
            </div>

            <h3 className="mb-3 break-words text-3xl font-semibold leading-tight text-foreground sm:mb-4 sm:text-4xl">
              {entry.entryName}
            </h3>

            <dl className="space-y-1.5">
              {pronunciations.map((pronunciation, index) => (
                <Fragment key={`${pronunciation.jyutping ?? "meaning"}-${index}`}>
                  {pronunciation.jyutping && (
                    <ShareMetaRow label={labels.jyutping}>
                      {pronunciation.jyutping}
                    </ShareMetaRow>
                  )}

                  {pronunciation.singer && (
                    <ShareMetaRow label={labels.singer}>
                      {pronunciation.singer}
                    </ShareMetaRow>
                  )}

                  {pronunciation.meaning && (
                    <ShareMetaRow label={labels.meaning}>
                      <span className="line-clamp-3">
                        {pronunciation.meaning}
                      </span>
                    </ShareMetaRow>
                  )}

                  {pronunciation.introduction && (
                    <ShareMetaRow label={labels.introduction}>
                      <span className="line-clamp-3">
                        {pronunciation.introduction}
                      </span>
                    </ShareMetaRow>
                  )}

                  {pronunciation.emotion && (
                    <ShareMetaRow label={labels.emotion}>
                      {pronunciation.emotion}
                    </ShareMetaRow>
                  )}

                  {pronunciation.emotionIntensity && (
                    <ShareMetaRow label={labels.emotionIntensity}>
                      {pronunciation.emotionIntensity}
                    </ShareMetaRow>
                  )}

                  {pronunciation.other && (
                    <ShareMetaRow label={labels.other}>
                      <span className="line-clamp-3">
                        {pronunciation.other}
                      </span>
                    </ShareMetaRow>
                  )}
                </Fragment>
              ))}

              {(sourceName || categoryName || hasTags || contributorId) && (
                <div className="my-3 border-t border-primary" />
              )}

              {sourceName && (
                <ShareMetaRow label={labels.source}>{sourceName}</ShareMetaRow>
              )}

              {categoryName && (
                <ShareMetaRow label={labels.category}>
                  {categoryName}
                </ShareMetaRow>
              )}

              {entry.tags.related.length > 0 && (
                <ShareMetaRow label={labels.tags}>
                  <div className="flex flex-wrap gap-1.5">
                    {entry.tags.related.map((tag) => (
                      <Badge
                        key={`${tag.role}-${tag.id}`}
                        variant="secondary"
                        className="rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </ShareMetaRow>
              )}

              {entry.tags.recommended.length > 0 && (
                <ShareMetaRow label={labels.recommendedTags}>
                  <div className="flex flex-wrap gap-1.5">
                    {entry.tags.recommended.map((tag) => (
                      <Badge
                        key={`${tag.role}-${tag.id}`}
                        variant="secondary"
                        className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-semibold text-muted-foreground"
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </ShareMetaRow>
              )}

              {contributorId && (
                <ShareMetaRow label={labels.contributors}>
                  {contributorId}
                </ShareMetaRow>
              )}
            </dl>

            <p className="mt-6 font-mono text-xs text-muted-foreground">
              {labels.uniqueId}: {compactId(entry.entryId)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-stretch gap-2 border-t border-border bg-muted/30 px-4 py-3 sm:justify-end sm:px-7 sm:py-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={handleDownloadImage}
          >
            {labels.downloadImage}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={() => copyText(shareUrl, labels.copied)}
          >
            {labels.copyLink}
          </Button>
          {entry.share.cardUrl && (
            <Button
              type="button"
              className="flex-1 sm:flex-none"
              asChild
            >
              <a
                href={entry.share.cardUrl + `&mode=${theme === "dark" ? "dark" : "light"}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {labels.openCard}
              </a>
            </Button>
          )}
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
  returnQuery,
}: {
  entry: EntryIdentity;
  labels: {
    title: string;
    datasetScope?: string;
    share: string;
    edit: string;
    editing: string;
    copied: string;
    source: string;
    primaryCategory: string;
    secondaryCategory: string;
    contributors: string;
    media: MediaLabels;
  };
  canEdit: boolean;
  isEditLoading: boolean;
  onEdit?: (entry: EntryIdentity) => void;
  onShare: (entry: EntryIdentity) => void;
  returnQuery?: string;
}) {
  const displayJyutping = primaryJyutping(entry);
  const hasMetadata = Boolean(displayJyutping);

  return (
    <section className="border-b border-border/60 px-4 py-8 sm:px-0">
      <div className="max-w-5xl">
        <div className="mb-4 flex items-center gap-2">
          <span className="h-5 w-1 rounded-full bg-primary/70" />
          <p className="text-sm font-semibold text-primary">{labels.title}</p>
          {labels.datasetScope && (
            <span className="text-xs text-muted-foreground">
              {labels.datasetScope}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <Link
            href={entryHref(entry, returnQuery)}
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
              {displayJyutping && (
                <span className="font-medium leading-6 text-muted-foreground/90">
                  {displayJyutping}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-5">
          {entry.meaning && (
            <p className="max-w-3xl text-base leading-8 text-foreground">
              {entry.meaning}
            </p>
          )}

          <PrimaryMediaPreview
            entry={entry}
            labels={labels.media}
            returnQuery={returnQuery}
          />

          <PrimaryIdentityInfo
            entry={entry}
            labels={{
              source: labels.source,
              primaryCategory: labels.primaryCategory,
              secondaryCategory: labels.secondaryCategory,
              contributors: labels.contributors,
            }}
          />

          {entry.tags.related.length > 0 && (
            <div className="max-w-3xl">
              <TagList entry={entry} relatedLimit={6} />
            </div>
          )}

          {entry.tags.recommended.length > 0 && (
            <div className="max-w-3xl">
              <RecommendedTagList entry={entry} limit={6} />
            </div>
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
      <div className="max-w-4xl text-sm text-muted-foreground">{text}</div>
    </section>
  );
}

function EntryTile({
  entry,
  labels,
  dense = false,
  returnQuery,
}: {
  entry: EntryIdentity;
  labels: {
    media: MediaLabels;
  };
  dense?: boolean;
  returnQuery?: string;
}) {
  const displayJyutping = primaryJyutping(entry);

  return (
    <article className="group flex min-h-[196px] flex-col rounded-lg border border-border/80 bg-background p-4 shadow-sm shadow-black/5 transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md hover:shadow-black/10">
      <Link href={entryHref(entry, returnQuery)} className="mb-4 block min-w-0">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          {displayCategory(entry)}
        </div>
        <h3 className="line-clamp-2 min-w-0 break-words text-lg font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
          {entry.entryName}
        </h3>
        {displayJyutping && (
          <p className="mt-2 line-clamp-2 text-sm font-medium leading-5 text-muted-foreground">
            {displayJyutping}
          </p>
        )}
        {entry.meaning && (
          <p className="mt-3 line-clamp-2 border-l-2 border-border pl-3 text-sm leading-6 text-muted-foreground">
            {entry.meaning}
          </p>
        )}
      </Link>
      <div className="mt-auto space-y-3">
        <MediaControls
          entry={entry}
          labels={labels.media}
          compact
          returnQuery={returnQuery}
        />
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
  returnQuery,
  headerAccessory,
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
  returnQuery?: string;
  headerAccessory?: React.ReactNode;
}) {
  const gridClass =
    columns === 4
      ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      : "grid gap-4 sm:grid-cols-3";
  const entriesKey = entries.map((entry) => entry.entryId).join("|") || "empty";

  return (
    <section className="px-4 py-7 sm:px-0">
      <div className="mb-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
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
        {headerAccessory}
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
                returnQuery={returnQuery}
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

function MediaFilter({
  value,
  onChange,
  labels,
}: {
  value?: SearchMediaFilter;
  onChange: (value?: SearchMediaFilter) => void;
  labels: {
    group: string;
    all: string;
    text: string;
    audio: string;
    video: string;
    image: string;
    model3d: string;
  };
}) {
  const options: Array<{ value?: SearchMediaFilter; label: string }> = [
    { label: labels.all },
    { value: "text", label: labels.text },
    { value: "audio", label: labels.audio },
    { value: "video", label: labels.video },
    { value: "image", label: labels.image },
    { value: "model3d", label: labels.model3d },
  ];

  return (
    <div
      role="group"
      aria-label={labels.group}
      className="flex max-w-full flex-wrap items-center gap-1.5"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Button
            key={option.value ?? "all"}
            type="button"
            size="sm"
            variant={selected ? "secondary" : "ghost"}
            aria-pressed={selected}
            className={cn(
              "h-8 rounded-full px-3 text-xs font-medium",
              selected && "bg-primary/10 text-primary hover:bg-primary/15",
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

type MediaLabels = {
  audio: string;
  video: string;
  image: string;
  model3d: string;
  openModel3d: string;
  videoTranscript: string;
  openVideoSource: string;
  audioPlayFailed: string;
};

export function EntrySearchSections({
  result,
  primaryDatasetLabel,
  isLoadingPrimary,
  isLoadingSimilar,
  isLoadingRecommended,
  isRefreshingSimilar,
  isRefreshingRecommended,
  onRefreshSimilar,
  onRefreshRecommended,
  mediaType,
  onMediaTypeChange,
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
    model3d: t("model3d"),
    openModel3d: t("openModel3d"),
    videoTranscript: t("videoTranscript"),
    openVideoSource: t("openVideoSource"),
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
            datasetScope: primaryDatasetLabel
              ? t("primaryDatasetScope", { dataset: primaryDatasetLabel })
              : undefined,
            share: t("share"),
            edit: t("edit"),
            editing: t("editing"),
            copied: t("copied"),
            source: t("source"),
            primaryCategory: t("primaryCategory"),
            secondaryCategory: t("secondaryCategory"),
            contributors: t("contributors"),
            media: mediaLabels,
          }}
          canEdit={canEditEntry(result.primary, user)}
          isEditLoading={editingEntryId === result.primary.entryId}
          onEdit={handleEditEntry}
          onShare={setShareEntry}
          returnQuery={result.query}
        />
      ) : (
        <EmptyPrimary
          text={
            primaryDatasetLabel
              ? t("emptyPrimaryInDataset", { dataset: primaryDatasetLabel })
              : t("emptyPrimary")
          }
        />
      )}
      <ResultSection
        title={t("similarTitle")}
        entries={result.similar}
        refreshLabel={t("refresh")}
        emptyLabel={mediaType ? t("emptyMediaResults") : t("emptyResults")}
        labels={commonLabels}
        isRefreshing={isLoadingSimilar || isRefreshingSimilar}
        onRefresh={result.cursors.similarNext ? onRefreshSimilar : undefined}
        returnQuery={result.query}
        headerAccessory={
          onMediaTypeChange ? (
            <MediaFilter
              value={mediaType}
              onChange={onMediaTypeChange}
              labels={{
                group: t("mediaFilterLabel"),
                all: t("mediaAll"),
                text: t("mediaText"),
                audio: t("audio"),
                video: t("video"),
                image: t("image"),
                model3d: t("mediaModel3d"),
              }}
            />
          ) : undefined
        }
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
        returnQuery={result.query}
      />
      <SharePreview
        entry={shareEntry}
        open={Boolean(shareEntry)}
        labels={{
          title: t("sharePreviewTitle"),
          uniqueId: t("uniqueId"),
          downloadImage: t("downloadImage"),
          downloadImageFailed: t("downloadImageFailed"),
          copyLink: t("copyLink"),
          openCard: t("openCard"),
          copied: t("copied"),
          jyutping: t("jyutping"),
          singer: t("singer"),
          meaning: t("meaning"),
          introduction: t("introduction"),
          source: t("source"),
          category: t("category"),
          tags: t("tags"),
          keyTags: t("keyTags"),
          recommendedTags: t("recommendedTags"),
          contributors: t("contributors"),
          media: mediaLabels,
          emotion: t("emotion"),
          emotionIntensity: t("emotionIntensity"),
          other: t("other"),
        }}
        onOpenChange={(open) => {
          if (!open) setShareEntry(null);
        }}
      />
    </div>
  );
}
