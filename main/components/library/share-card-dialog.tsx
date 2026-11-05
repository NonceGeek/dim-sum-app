"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy, Download } from "lucide-react";
import { getPathname } from "@/i18n/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PublicDataset } from "@/lib/library/public-datasets";
import { displayTags, useDatasetLabels } from "./dataset-card";
import { drawShareCard } from "./share-card-canvas";

export function useDatasetShareUrl(slug: string | undefined) {
  const locale = useLocale();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  if (!slug) return "";
  const path = getPathname({
    locale,
    href: `/library/datasets/${encodeURIComponent(slug)}`,
  });
  return `${origin}${path}`;
}

export function ShareCardDialog({
  dataset,
  onOpenChange,
}: {
  dataset: PublicDataset | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Library.share");
  const labels = useDatasetLabels();
  const url = useDatasetShareUrl(dataset?.slug);
  const image = useMemo(() => {
    if (!dataset || !url || typeof document === "undefined") return null;
    try {
      return drawShareCard({
        brand: t("brand"),
        title: dataset.zhName,
        subtitle: dataset.enName,
        description: dataset.description,
        tags: displayTags(dataset, labels),
        summary: [
          dataset.scaleSummary ?? "",
          dataset.languageScope ?? "",
          labels.access(dataset.accessMode),
        ],
        url,
      });
    } catch {
      return null;
    }
    // labels/t are stable per locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  };
  const save = () => {
    if (!image || !dataset) return toast.error(t("saveFailed"));
    const a = document.createElement("a");
    a.href = image;
    a.download = `dimsum-${dataset.slug}.png`;
    a.click();
    toast.success(t("saved"));
  };

  return (
    <Dialog open={!!dataset} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("note")}</DialogDescription>
        </DialogHeader>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={dataset?.zhName ?? ""}
            className="mx-auto w-full max-w-xs rounded-lg border shadow-sm"
          />
        ) : (
          <div className="mx-auto aspect-[4/5] w-full max-w-xs animate-pulse rounded-lg bg-muted" />
        )}
        <div className="flex gap-2">
          <Input readOnly value={url} aria-label={t("copyLink")} onFocus={(e) => e.target.select()} />
          <Button variant="outline" size="icon" aria-label={t("copyLink")} onClick={copy}>
            <Copy />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={copy}>
            <Copy /> {t("copyLink")}
          </Button>
          <Button onClick={save} disabled={!image}>
            <Download /> {t("saveCard")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
