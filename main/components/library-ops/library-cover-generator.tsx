"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@tanstack/react-query";
import { Check,Image,Loader2,Upload } from "lucide-react";
import { useLocale,useTranslations } from "next-intl";
import { useEffect,useState } from "react";
import { toast } from "sonner";
import { json } from "./ops-shared";

type CoverResponse = {
  generationId: string;
  images: Array<{ index: number; url: string; expiresAt: string }>;
  size: string;
};

/**
 * AI-assisted Library cover: same generate → pick → upload-to-OSS flow as the
 * activity banner. The chosen permanent URL is handed back via `onSelect`; it is
 * only persisted when the profile dialog is saved.
 */
export function LibraryCoverGenerator({
  datasetName,
  defaultPrompt,
  currentCover,
  onSelect,
}: {
  datasetName: string;
  defaultPrompt: string;
  currentCover: string | null;
  onSelect: (url: string) => void;
}) {
  const t = useTranslations("LibraryOps.profile.ai");
  const locale = useLocale();
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [covers, setCovers] = useState<CoverResponse | null>(null);
  const [uploaded, setUploaded] = useState<Record<string, string>>({});
  const [uploadingUrl, setUploadingUrl] = useState<string | null>(null);

  useEffect(() => setPrompt(defaultPrompt), [defaultPrompt]);

  const generate = useMutation({
    mutationFn: async () =>
      json<CoverResponse>(
        await fetch("/api/admin/corpus-collection/covers/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt.trim(), datasetName }),
        }),
      ),
    onSuccess: (result) => {
      setCovers(result);
      setUploaded({});
      toast.success(t("generated"));
    },
    onError: () => toast.error(t("generateFailed")),
  });

  const select = useMutation({
    mutationFn: async (url: string) => {
      setUploadingUrl(url);
      return json<{ url: string }>(
        await fetch("/api/admin/corpus-collection/covers/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, datasetName }),
        }),
      );
    },
    onSuccess: (result, sourceUrl) => {
      setUploaded((current) => ({ ...current, [sourceUrl]: result.url }));
      onSelect(result.url);
      toast.success(t("applied"));
    },
    onError: () => toast.error(t("uploadFailed")),
    onSettled: () => setUploadingUrl(null),
  });

  const formatExpiry = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div>
        <b className="block text-sm">{t("title")}</b>
        <span className="text-xs text-muted-foreground">{t("description")}</span>
      </div>
      <Textarea
        rows={3}
        maxLength={1000}
        placeholder={t("promptPlaceholder")}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => generate.mutate()}
        disabled={!prompt.trim() || generate.isPending}
      >
        {generate.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Image className="mr-2 h-4 w-4" />
        )}
        {covers ? t("regenerate") : t("generate")}
      </Button>
      {covers && (
        <div className="grid gap-3 sm:grid-cols-2">
          {covers.images.map((image) => {
            const permanentUrl = uploaded[image.url];
            const inUse = !!permanentUrl && permanentUrl === currentCover;
            return (
              <div key={image.index} className="overflow-hidden rounded-md border bg-background">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={t("candidate", { index: image.index + 1 })}
                  className="aspect-video w-full bg-muted object-cover"
                />
                <div className="flex items-center justify-between gap-2 p-2">
                  <span className="text-xs text-muted-foreground">
                    {t("expires", { date: formatExpiry(image.expiresAt) })}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant={inUse ? "secondary" : "outline"}
                    onClick={() => select.mutate(image.url)}
                    disabled={select.isPending || inUse}
                  >
                    {uploadingUrl === image.url ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : inUse ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {inUse ? t("inUse") : t("use")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
