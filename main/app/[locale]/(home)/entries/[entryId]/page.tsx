import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchEntryIdentityByUniqueId } from "@/lib/search/entry-query";
import { CalendarDays, Tags, UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { CopyEntryIdButton } from "./copy-entry-id-button";

type EntryPageProps = {
  params: Promise<{
    locale: string;
    entryId: string;
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

export default async function EntryPage({ params }: EntryPageProps) {
  const { entryId, locale } = await params;
  const t = await getTranslations({ locale, namespace: "EntryDetail" });
  const entry = await fetchEntryIdentityByUniqueId(entryId);

  if (!entry) notFound();

  const tags = [...entry.tags.related, ...entry.tags.recommended].slice(0, 10);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: entry.entryName,
    description: entry.meaning ?? undefined,
    identifier: entry.entryId,
    inDefinedTermSet: "DimSum Cantonese Corpus",
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mb-8 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild className="-ml-3">
          <Link href={`/search?mode=entry&q=${encodeURIComponent(entry.entryName)}`}>
            {t("backToSearch")}
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={entry.share.cardUrl} target="_blank" rel="noopener noreferrer">
            {t("shareCard")}
          </a>
        </Button>
      </div>

      <article className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div className="mb-3 text-sm font-semibold text-muted-foreground">
            {t("eyebrow")}
          </div>
          <h1 className="break-words text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
            {entry.entryName}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {entry.jyutping && <span className="font-medium">{entry.jyutping}</span>}
            <span>{displayCategory(entry)}</span>
            <CopyEntryIdButton entryId={entry.entryId} />
          </div>

          {entry.meaning && (
            <section className="mt-8 border-t border-border pt-6">
              <h2 className="mb-3 text-lg font-semibold text-foreground">
                {t("meaning")}
              </h2>
              <p className="max-w-3xl text-base leading-8 text-foreground">
                {entry.meaning}
              </p>
            </section>
          )}

          {(entry.assets.audioUrl || entry.assets.videoUrl || entry.assets.coverImage) && (
            <section className="mt-8 border-t border-border pt-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">
                {t("media")}
              </h2>
              <div className="space-y-4">
                {entry.assets.coverImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.assets.coverImage}
                    alt={entry.entryName}
                    className="max-h-[420px] w-full rounded-md border border-border object-contain"
                  />
                )}
                {entry.assets.videoUrl && (
                  <video
                    src={entry.assets.videoUrl}
                    controls
                    className="w-full rounded-md border border-border"
                    poster={entry.assets.coverImage ?? undefined}
                  />
                )}
                {entry.assets.audioUrl && (
                  <audio src={entry.assets.audioUrl} controls className="w-full" />
                )}
              </div>
            </section>
          )}

          {tags.length > 0 && (
            <section className="mt-8 border-t border-border pt-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                <Tags className="h-4 w-4" />
                {t("tags")}
              </h2>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge
                    key={`${tag.role}-${tag.id}`}
                    variant="secondary"
                    className="rounded"
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="h-fit rounded-md border border-border bg-muted/20 p-4">
          <h2 className="text-sm font-semibold text-foreground">{t("info")}</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-muted-foreground">{t("category")}</dt>
              <dd className="mt-1 font-medium text-foreground">
                {displayCategory(entry)}
              </dd>
            </div>
            {entry.category.primary && (
              <div>
                <dt className="text-muted-foreground">{t("primaryCategory")}</dt>
                <dd className="mt-1 text-foreground">{entry.category.primary.name}</dd>
              </div>
            )}
            {entry.category.secondary && (
              <div>
                <dt className="text-muted-foreground">{t("secondaryCategory")}</dt>
                <dd className="mt-1 text-foreground">{entry.category.secondary.name}</dd>
              </div>
            )}
            {entry.source.contributorIds.length > 0 && (
              <div>
                <dt className="flex items-center gap-1 text-muted-foreground">
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
                <dt className="flex items-center gap-1 text-muted-foreground">
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
