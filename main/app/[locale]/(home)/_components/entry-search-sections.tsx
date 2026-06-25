"use client";

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

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
  toast.success("已复制");
}

function playAudio(url: string) {
  const audio = new Audio(url);
  audio.play().catch(() => {
    toast.error("音频播放失败");
  });
}

function MediaControls({
  entry,
  compact = false,
}: {
  entry: EntryIdentity;
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
          onClick={() => playAudio(audioUrl)}
        >
          <Volume2 className={`${iconClass} mr-1`} />
          音频
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
            视频
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
            图片
          </a>
        </Button>
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
  onOpenChange,
}: {
  entry: EntryIdentity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>分享卡片预览</DialogTitle>
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
          <MediaControls entry={entry} />
          <TagList entry={entry} />
          <p className="mt-4 font-mono text-xs text-muted-foreground">
            Unique ID: {compactId(entry.entryId)}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => copyText(entry.share.seoUrl)}
          >
            复制链接
          </Button>
          <Button type="button" asChild>
            <a href={entry.share.cardUrl} target="_blank" rel="noopener noreferrer">
              打开卡片
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PrimaryEntry({
  entry,
  onShare,
}: {
  entry: EntryIdentity;
  onShare: (entry: EntryIdentity) => void;
}) {
  return (
    <section className="border-b border-border px-4 py-6 sm:px-0">
      <div className="max-w-4xl">
        <div className="mb-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">精准匹配</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="break-words text-3xl font-semibold leading-tight text-foreground">
                {entry.entryName}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-md"
                aria-label="分享"
                onClick={() => onShare(entry)}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {entry.jyutping && <span className="font-medium">{entry.jyutping}</span>}
          <span>{displayCategory(entry)}</span>
          <button
            type="button"
            onClick={() => copyText(entry.entryId)}
            className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 font-mono text-xs hover:bg-muted"
          >
            {compactId(entry.entryId)}
            <Copy className="h-3 w-3" />
          </button>
        </div>

        {entry.meaning && (
          <p className="mb-4 max-w-3xl text-sm leading-6 text-foreground">
            {entry.meaning}
          </p>
        )}

        <div className="mb-3">
          <MediaControls entry={entry} />
        </div>
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

function EmptyPrimary() {
  return (
    <section className="border-b border-border px-4 py-5 sm:px-0">
      <div className="max-w-4xl text-sm text-muted-foreground">
        未找到完全匹配词条
      </div>
    </section>
  );
}

function EntryTile({ entry, dense = false }: { entry: EntryIdentity; dense?: boolean }) {
  return (
    <article className="flex min-h-[168px] flex-col rounded-md border border-border bg-background p-4 transition-colors hover:bg-muted/30">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 min-w-0 break-words text-base font-semibold leading-snug text-foreground">
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
        <p className="mb-3 line-clamp-2 text-sm leading-5 text-muted-foreground">
          {entry.meaning}
        </p>
      )}
      <div className="mt-auto space-y-2">
        <MediaControls entry={entry} compact />
        <TagList entry={entry} limit={dense ? 4 : 5} />
        <button
          type="button"
          onClick={() => copyText(entry.entryId)}
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
  isRefreshing,
  onRefresh,
  columns = 3,
  dense = false,
}: {
  title: string;
  entries: EntryIdentity[];
  refreshLabel: string;
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
            <EntryTile key={entry.entryId} entry={entry} dense={dense} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">暂无结果</p>
      )}
    </section>
  );
}

export function EntrySearchSections({
  result,
  isLoadingPrimary,
  isLoadingSemantic,
  isRefreshingSimilar,
  isRefreshingRecommended,
  onRefreshSimilar,
  onRefreshRecommended,
}: EntrySearchSectionsProps) {
  const [shareEntry, setShareEntry] = useState<EntryIdentity | null>(null);

  return (
    <div className="mx-auto w-full max-w-5xl">
      {isLoadingPrimary ? (
        <PrimaryLoading />
      ) : result.primary ? (
        <PrimaryEntry entry={result.primary} onShare={setShareEntry} />
      ) : (
        <EmptyPrimary />
      )}
      <ResultSection
        title="相关表达"
        entries={result.similar}
        refreshLabel="换一批"
        isRefreshing={isLoadingSemantic || isRefreshingSimilar}
        onRefresh={result.cursors.similarNext ? onRefreshSimilar : undefined}
      />
      <ResultSection
        title="继续探索"
        entries={result.recommended}
        refreshLabel="换一批"
        isRefreshing={isLoadingSemantic || isRefreshingRecommended}
        onRefresh={result.cursors.recommendedNext ? onRefreshRecommended : undefined}
        columns={4}
        dense
      />
      <SharePreview
        entry={shareEntry}
        open={Boolean(shareEntry)}
        onOpenChange={(open) => {
          if (!open) setShareEntry(null);
        }}
      />
    </div>
  );
}
