"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PublicDataset } from "@/lib/library/public-datasets";
import { Share2 } from "lucide-react";

export function useDatasetLabels() {
  const t = useTranslations("Library.options");
  return {
    modality: (v: string) => t(`modality.${v}`),
    useCase: (v: string) => t(`useCase.${v}`),
    access: (v: string) => t(`access.${v}`),
    flag: (v: string) => t(`flag.${v}`),
  };
}

export function DatasetCover({
  dataset,
  className,
}: {
  dataset: PublicDataset;
  className?: string;
}) {
  const labels = useDatasetLabels();
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-gradient-to-br from-primary to-primary/60",
        className,
      )}
    >
      {dataset.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataset.coverImageUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      ) : (
        <span className="absolute bottom-3 left-4 text-lg font-semibold text-primary-foreground">
          {dataset.modalities.map(labels.modality).join(" · ") || dataset.zhName}
        </span>
      )}
      {dataset.statusFlags[0] && (
        <Badge variant="outline" className="absolute right-3 top-3 border-transparent bg-background/90 text-foreground">
          {labels.flag(dataset.statusFlags[0])}
        </Badge>
      )}
    </div>
  );
}

/** Tags shown on cards: public tags first, then modality/use labels. */
export function displayTags(
  dataset: PublicDataset,
  labels: ReturnType<typeof useDatasetLabels>,
) {
  const tags = dataset.tags.length
    ? dataset.tags
    : [
        ...dataset.modalities.map(labels.modality),
        ...dataset.useCases.map(labels.useCase),
      ];
  return tags.slice(0, 3);
}

function meta(dataset: PublicDataset, labels: ReturnType<typeof useDatasetLabels>) {
  return [dataset.scaleSummary, dataset.languageScope, labels.access(dataset.accessMode)]
    .filter(Boolean)
    .join(" · ");
}

export function DatasetCard({
  dataset,
  onShare,
}: {
  dataset: PublicDataset;
  onShare: (dataset: PublicDataset) => void;
}) {
  const t = useTranslations("Library.card");
  const labels = useDatasetLabels();
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md">
      <Link href={`/library/datasets/${encodeURIComponent(dataset.slug)}`}>
        <DatasetCover dataset={dataset} className="h-40" />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link
          href={`/library/datasets/${encodeURIComponent(dataset.slug)}`}
          className="hover:underline"
        >
          <h3 className="line-clamp-2 text-base font-semibold">{dataset.zhName}</h3>
        </Link>
        {dataset.enName && (
          <p className="line-clamp-1 text-sm text-muted-foreground">{dataset.enName}</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {displayTags(dataset, labels).map((tag) => (
            <Badge key={tag} variant="secondary" className="font-normal">
              {tag}
            </Badge>
          ))}
        </div>
        {dataset.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {dataset.description}
          </p>
        )}
        <p className="mt-auto text-xs text-muted-foreground">{meta(dataset, labels)}</p>
        <div className="flex items-center justify-between pt-1">
          <Button variant="ghost" size="sm" onClick={() => onShare(dataset)}>
            <Share2 /> {t("share")}
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/library/datasets/${encodeURIComponent(dataset.slug)}`}>
              {t("details")}
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

export function DatasetListRow({
  dataset,
  onShare,
}: {
  dataset: PublicDataset;
  onShare: (dataset: PublicDataset) => void;
}) {
  const t = useTranslations("Library.card");
  const labels = useDatasetLabels();
  const href = `/library/datasets/${encodeURIComponent(dataset.slug)}`;
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b px-3 py-3 last:border-b-0 md:grid-cols-[90px_minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <span className="hidden text-xs font-medium text-primary md:block">
        {dataset.statusFlags[0] ? labels.flag(dataset.statusFlags[0]) : "—"}
      </span>
      <Link href={href} className="min-w-0 hover:underline">
        <b className="block truncate text-sm">{dataset.zhName}</b>
        <span className="block truncate text-xs text-muted-foreground">
          {dataset.enName ?? meta(dataset, labels)}
        </span>
      </Link>
      <span className="hidden flex-wrap gap-1 md:flex">
        {displayTags(dataset, labels).map((tag) => (
          <Badge key={tag} variant="secondary" className="font-normal">
            {tag}
          </Badge>
        ))}
      </span>
      <span className="hidden truncate text-sm md:block">{dataset.scaleSummary ?? "—"}</span>
      <span className="hidden truncate text-sm md:block">
        {labels.access(dataset.accessMode)}
      </span>
      <Button
        variant="ghost"
        size="sm"
        aria-label={t("share")}
        onClick={() => onShare(dataset)}
      >
        <Share2 />
        <span className="hidden lg:inline">{t("share")}</span>
      </Button>
    </div>
  );
}

export function DatasetListHeader() {
  const t = useTranslations("Library.card");
  return (
    <div className="hidden grid-cols-[90px_minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground md:grid">
      <span>{t("status")}</span>
      <span>{t("dataset")}</span>
      <span>{t("modality")}</span>
      <span>{t("scale")}</span>
      <span>{t("access")}</span>
      <span className="w-16" />
    </div>
  );
}
