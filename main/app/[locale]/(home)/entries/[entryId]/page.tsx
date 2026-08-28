import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchEntryIdentityByUniqueId } from "@/lib/search/entry-query";
import {
  ArrowLeft,
  CalendarDays,
  Database,
  Share2,
  UserRound,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { CopyEntryIdButton } from "./copy-entry-id-button";
import { Model3dCard } from "@/components/media/model3d-card";

type EntryPageProps = {
  params: Promise<{
    locale: string;
    entryId: string;
  }>;
  searchParams?: Promise<{
    fromSearch?: string;
  }>;
};

function displayCategory(entry: Awaited<ReturnType<typeof fetchEntryIdentityByUniqueId>>) {
  if (!entry) return "";
  return (
    entry.category.secondary?.name ||
    entry.category.primary?.name ||
    entry.source.categoryDisplayName ||
    entry.source.categoryName
  );
}

function formatDate(value: string, locale: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export async function generateMetadata({ params }: EntryPageProps): Promise<Metadata> {
  const { entryId, locale } = await params;
  const t = await getTranslations({ locale, namespace: "EntryDetail" });
  const entry = await fetchEntryIdentityByUniqueId(entryId);

  if (!entry) {
    return {
      title: `${t("notFoundTitle")} | DimSum AI Labs`,
    };
  }

  const title = `${entry.entryName} | ${t("metadataSuffix")}`;
  const description =
    entry.meaning ||
    [entry.jyutping, displayCategory(entry)].filter(Boolean).join(" · ") ||
    t("metadataDescription");

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: entry.assets.coverImage ? [entry.assets.coverImage] : undefined,
    },
  };
}

export default async function EntryPage({ params, searchParams }: EntryPageProps) {
  const { entryId, locale } = await params;
  const resolvedSearchParams = await searchParams;
  const t = await getTranslations({ locale, namespace: "EntryDetail" });
  const entry = await fetchEntryIdentityByUniqueId(entryId);

  if (!entry) notFound();

  const returnQuery = resolvedSearchParams?.fromSearch?.trim() || entry.entryName;
  const backToSearchHref =
    `/search?mode=entry&dataset=all&q=${encodeURIComponent(returnQuery)}`;
  const relatedTags = entry.tags.related.slice(0, 10);
  const recommendedTags = entry.tags.recommended.slice(0, 10);
  const hasMedia = Boolean(
    entry.assets.audioUrl ||
      entry.assets.videoUrl ||
      entry.assets.coverImage ||
      entry.assets.model3dUrl,
  );
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: entry.entryName,
    description: entry.meaning ?? undefined,
    identifier: entry.entryId,
    inDefinedTermSet: "DimSum Cantonese Corpus",
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mb-10">
        <Button variant="ghost" size="sm" asChild className="-ml-3 text-muted-foreground">
          <Link href={backToSearchHref}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {t("backToSearch")}
          </Link>
        </Button>
      </div>

      <article className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div className="mb-5 flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-primary/70" />
            <p className="text-sm font-semibold text-primary">{t("eyebrow")}</p>
          </div>

          <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
            <h1 className="min-w-0 max-w-4xl break-words text-4xl font-semibold leading-tight tracking-normal text-foreground sm:text-5xl">
              {entry.entryName}
            </h1>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="mt-1 h-8 rounded-md px-2 text-muted-foreground hover:bg-primary/10 hover:text-primary"
            >
              <a href={entry.share.cardUrl} target="_blank" rel="noopener noreferrer">
                <Share2 className="mr-1.5 h-4 w-4" />
                {t("shareCard")}
              </a>
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
            {entry.jyutping && (
              <span className="font-medium leading-6 text-muted-foreground/90">
                {entry.jyutping}
              </span>
            )}
          </div>

          {entry.meaning && (
            <p className="mt-8 max-w-3xl text-lg leading-9 text-foreground">
              {entry.meaning}
            </p>
          )}

          {hasMedia && (
            <section className="mt-8 max-w-3xl space-y-4">
              {entry.assets.coverImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={entry.assets.coverImage}
                  alt={entry.entryName}
                  className="max-h-[420px] w-full rounded-lg border border-border object-contain"
                />
              )}
              {entry.assets.videoUrl && (
                <video
                  src={entry.assets.videoUrl}
                  controls
                  className="w-full rounded-lg border border-border"
                  poster={entry.assets.coverImage ?? undefined}
                />
              )}
              {entry.assets.audioUrl && (
                <audio src={entry.assets.audioUrl} controls className="h-10 w-full" />
              )}
              {entry.assets.model3dUrl && (
                <Model3dCard
                  url={entry.assets.model3dUrl}
                  entryName={entry.entryName}
                  modelLabel={t("model3d")}
                  openLabel={t("openModel3d")}
                />
              )}
            </section>
          )}

          {(relatedTags.length > 0 || recommendedTags.length > 0) && (
            <section className="mt-7 max-w-3xl space-y-2">
              {relatedTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
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
              )}
              {recommendedTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
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
              )}
            </section>
          )}

          <div className="mt-6">
            <CopyEntryIdButton entryId={entry.entryId} />
          </div>
        </div>

        <aside className="h-fit rounded-lg border border-border/80 bg-background p-5 shadow-sm shadow-black/5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Database className="h-4 w-4 text-primary" />
            {t("info")}
          </h2>
          <dl className="mt-5 space-y-5 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase text-muted-foreground">
                {t("source")}
              </dt>
              <dd className="mt-1 font-medium text-foreground">
                {entry.source.categoryDisplayName || entry.source.categoryName}
              </dd>
            </div>
            {entry.category.primary && (
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">
                  {t("primaryCategory")}
                </dt>
                <dd className="mt-1 text-foreground">{entry.category.primary.name}</dd>
              </div>
            )}
            {entry.category.secondary && (
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">
                  {t("secondaryCategory")}
                </dt>
                <dd className="mt-1 text-foreground">{entry.category.secondary.name}</dd>
              </div>
            )}
            {entry.source.contributorIds.length > 0 && (
              <div>
                <dt className="flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground">
                  <UserRound className="h-3.5 w-3.5" />
                  {t("contributors")}
                </dt>
                <dd className="mt-1 break-words font-mono text-xs text-foreground">
                  {entry.source.contributorIds.join("、")}
                </dd>
              </div>
            )}
            {formatDate(entry.updatedAt, locale) && (
              <div>
                <dt className="flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {t("updatedAt")}
                </dt>
                <dd className="mt-1 text-foreground">
                  {formatDate(entry.updatedAt, locale)}
                </dd>
              </div>
            )}
          </dl>
        </aside>
      </article>
    </main>
  );
}
