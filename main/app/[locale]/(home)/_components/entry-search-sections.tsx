"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, RefreshCcw, Share2 } from "lucide-react";
import type { EntryIdentity, EntrySearchResponse } from "@/lib/search/entry-identity";
import { toast } from "sonner";

type EntrySearchSectionsProps = {
  result: EntrySearchResponse;
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

function PrimaryEntry({ entry }: { entry: EntryIdentity }) {
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
            onClick={() => copyText(entry.share.seoUrl)}
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
  if (!entries.length) return null;

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
      <div className="grid gap-3 sm:grid-cols-3">
        {entries.map((entry) => (
          <EntryTile key={entry.entryId} entry={entry} />
        ))}
      </div>
    </section>
  );
}

export function EntrySearchSections({
  result,
  isRefreshingSimilar,
  isRefreshingRecommended,
  onRefreshSimilar,
  onRefreshRecommended,
}: EntrySearchSectionsProps) {
  if (!result.primary) {
    return (
      <div className="px-4 py-10 text-sm text-muted-foreground sm:px-0">
        未找到相关词条
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PrimaryEntry entry={result.primary} />
      <ResultSection
        title="二级相似结果"
        entries={result.similar}
        refreshLabel="换一批"
        isRefreshing={isRefreshingSimilar}
        onRefresh={result.cursors.similarNext ? onRefreshSimilar : undefined}
      />
      <ResultSection
        title="三级推荐结果"
        entries={result.recommended}
        refreshLabel="换一批"
        isRefreshing={isRefreshingRecommended}
        onRefresh={result.cursors.recommendedNext ? onRefreshRecommended : undefined}
      />
    </div>
  );
}
