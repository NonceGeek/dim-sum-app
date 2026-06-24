"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, RefreshCcw, Share2 } from "lucide-react";
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

function TagList({ entry }: { entry: EntryIdentity }) {
  const tags = [
    ...entry.tags.related.slice(0, 4),
    ...entry.tags.recommended.slice(0, 2),
  ];

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
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <span className="inline-block h-5 w-5 rounded-full border border-primary/30" />
            DimSum
          </div>
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
    <section className="border-b border-border px-4 py-5 sm:px-0">
      <div className="max-w-3xl">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
              一级精准结果
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-foreground">
              {entry.entryName}
            </h2>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="分享"
            onClick={() => onShare(entry)}
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {entry.jyutping && <span>{entry.jyutping}</span>}
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
          <p className="mb-3 text-sm leading-6 text-foreground">{entry.meaning}</p>
        )}

        <TagList entry={entry} />
      </div>
    </section>
  );
}

function PrimaryLoading() {
  return (
    <section className="border-b border-border px-4 py-5 sm:px-0">
      <div className="max-w-3xl">
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
      <div className="max-w-3xl text-sm text-muted-foreground">
        未找到完全匹配词条
      </div>
    </section>
  );
}

function EntryTile({ entry }: { entry: EntryIdentity }) {
  return (
    <article className="rounded-md border border-border bg-background p-3">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 text-sm font-semibold text-foreground">
          {entry.entryName}
        </h3>
        <span className="shrink-0 text-xs text-muted-foreground">
          {displayCategory(entry)}
        </span>
      </div>
      {entry.jyutping && (
        <p className="mb-1 text-xs text-muted-foreground">{entry.jyutping}</p>
      )}
      {entry.meaning && (
        <p className="mb-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
          {entry.meaning}
        </p>
      )}
      <TagList entry={entry} />
    </article>
  );
}

function ResultSection({
  title,
  entries,
  refreshLabel,
  isRefreshing,
  onRefresh,
}: {
  title: string;
  entries: EntryIdentity[];
  refreshLabel: string;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <section className="border-b border-border px-4 py-5 sm:px-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
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
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: title.includes("二级") ? 3 : 4 }).map((_, index) => (
            <div key={index} className="rounded-md border border-border p-3">
              <div className="mb-2 h-4 w-2/3 rounded bg-muted" />
              <div className="mb-2 h-3 w-1/2 rounded bg-muted" />
              <div className="h-10 w-full rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : entries.length ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {entries.map((entry) => (
            <EntryTile key={entry.entryId} entry={entry} />
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
    <div className="mx-auto w-full max-w-3xl">
      {isLoadingPrimary ? (
        <PrimaryLoading />
      ) : result.primary ? (
        <PrimaryEntry entry={result.primary} onShare={setShareEntry} />
      ) : (
        <EmptyPrimary />
      )}
      <ResultSection
        title="二级相似结果"
        entries={result.similar}
        refreshLabel="换一批"
        isRefreshing={isLoadingSemantic || isRefreshingSimilar}
        onRefresh={result.cursors.similarNext ? onRefreshSimilar : undefined}
      />
      <ResultSection
        title="三级推荐结果"
        entries={result.recommended}
        refreshLabel="换一批"
        isRefreshing={isLoadingSemantic || isRefreshingRecommended}
        onRefresh={result.cursors.recommendedNext ? onRefreshRecommended : undefined}
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
