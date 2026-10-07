export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getPathname } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { DatasetCover } from "@/components/library/dataset-card";
import { getPublicDataset } from "@/lib/library/public-datasets";
import { DatasetActions } from "./dataset-actions";

type Props = { params: Promise<{ locale: string; slug: string }> };

function decode(slug: string) {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "Library.detail" });
  const dataset = await getPublicDataset(decode(slug));
  if (!dataset) return { title: `${t("notFoundTitle")} | DimSum AI` };
  const title = `${dataset.zhName} | ${t("metadataSuffix")}`;
  const description = dataset.description ?? dataset.enName ?? undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: dataset.coverImageUrl ? [dataset.coverImageUrl] : undefined,
    },
  };
}

export default async function DatasetDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  const dataset = await getPublicDataset(decode(slug));
  if (!dataset) notFound();
  const t = await getTranslations({ locale, namespace: "Library" });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(dataset.updatedAt),
  );
  const tags = [
    ...dataset.modalities.map((m) => t(`options.modality.${m}`)),
    ...dataset.useCases.map((u) => t(`options.useCase.${u}`)),
    ...dataset.tags,
  ];
  const stats = [
    [t("card.scale"), dataset.scaleSummary],
    [t("card.language"), dataset.languageScope],
    [t("card.access"), t(`options.access.${dataset.accessMode}`)],
    [t("card.updated"), date],
  ] as const;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-8">
      <Link
        href={getPathname({ locale, href: "/library" })}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("detail.back")}
      </Link>
      <article className="overflow-hidden rounded-xl border bg-card">
        <DatasetCover dataset={dataset} className="h-48 sm:h-64" />
        <div className="space-y-6 p-5 sm:p-8">
          <header className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {dataset.statusFlags.map((f) => (
                <Badge key={f}>{t(`options.flag.${f}`)}</Badge>
              ))}
            </div>
            <h1 className="text-2xl font-bold sm:text-3xl">{dataset.zhName}</h1>
            {dataset.enName && <p className="text-muted-foreground">{dataset.enName}</p>}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[...new Set(tags)].map((tag) => (
                <Badge key={tag} variant="secondary" className="font-normal">
                  {tag}
                </Badge>
              ))}
            </div>
          </header>
          {dataset.description && (
            <section>
              <h2 className="mb-1 font-medium">{t("detail.about")}</h2>
              <p className="whitespace-pre-line text-muted-foreground">{dataset.description}</p>
            </section>
          )}
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map(([label, value]) => (
              <div key={label} className="rounded-lg bg-muted/50 p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-sm font-medium">{value || "—"}</dd>
              </div>
            ))}
          </dl>
          {dataset.usageNotes && (
            <section>
              <h2 className="mb-1 font-medium">{t("detail.usageNotes")}</h2>
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {dataset.usageNotes}
              </p>
            </section>
          )}
          <DatasetActions dataset={dataset} />
          <p className="text-xs text-muted-foreground">{t("detail.noDownload")}</p>
        </div>
      </article>
    </div>
  );
}
