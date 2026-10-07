"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DATASET_ACCESS_MODES,
  DATASET_MODALITIES,
  DATASET_USE_CASES,
} from "@/lib/library/options";
import { json } from "./ops-shared";

type Profile = {
  name: string;
  nickname: string | null;
  listed: boolean;
  enName: string | null;
  modalities: string[];
  useCases: string[];
  accessMode: string;
  isOfficial: boolean;
  metadataVerified: boolean;
  scaleSummary: string | null;
  languageScope: string | null;
  usageNotes: string | null;
  cover: string | null;
  link: string | null;
  tags: string[];
};

/** System-admin editor for the public Library fields of one dataset. */
export function LibraryProfileDialog({
  name,
  onClose,
}: {
  name: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("LibraryOps.profile");
  const tOpt = useTranslations("Library.options");
  const [draft, setDraft] = useState<Profile | null>(null);
  const [tagsText, setTagsText] = useState("");
  const profile = useQuery({
    queryKey: ["library-profile", name],
    enabled: !!name,
    queryFn: async () =>
      json<Profile>(await fetch(`/api/admin/library-profiles?name=${encodeURIComponent(name!)}`)),
  });
  useEffect(() => {
    if (profile.data) {
      setDraft(profile.data);
      setTagsText(profile.data.tags.join(", "));
    }
  }, [profile.data]);
  useEffect(() => {
    if (!name) setDraft(null);
  }, [name]);
  const save = useMutation({
    mutationFn: async () =>
      json(
        await fetch("/api/admin/library-profiles", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...draft,
            tags: tagsText
              .split(/[,，、]/)
              .map((s) => s.trim())
              .filter(Boolean),
          }),
        }),
      ),
    onSuccess: () => {
      toast.success(t("saved"));
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  const toggleIn = (key: "modalities" | "useCases", value: string, on: boolean) =>
    draft && set(key, on ? [...draft[key], value] : draft[key].filter((v) => v !== value));

  return (
    <Dialog open={!!name} onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {name} · {t("help")}
          </DialogDescription>
        </DialogHeader>
        {!draft ? (
          <p className="text-muted-foreground">{profile.isError ? (profile.error as Error).message : "…"}</p>
        ) : (
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <label className="flex items-center justify-between gap-3 rounded-lg border p-3 sm:col-span-2">
              <span>
                <b className="block text-sm">{t("listed")}</b>
                <span className="text-xs text-muted-foreground">{t("listedHint")}</span>
              </span>
              <Switch checked={draft.listed} onCheckedChange={(v) => set("listed", v)} />
            </label>
            <div className="space-y-1.5">
              <Label>{t("zhName")}</Label>
              <Input value={draft.nickname ?? draft.name} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lp-en">{t("enName")}</Label>
              <Input id="lp-en" maxLength={200} value={draft.enName ?? ""} onChange={(e) => set("enName", e.target.value)} />
            </div>
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">{t("modalities")}</legend>
              <div className="flex flex-wrap gap-3">
                {DATASET_MODALITIES.map((v) => (
                  <label key={v} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={draft.modalities.includes(v)} onChange={(e) => toggleIn("modalities", v, e.target.checked)} />
                    {tOpt(`modality.${v}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">{t("useCases")}</legend>
              <div className="flex flex-wrap gap-3">
                {DATASET_USE_CASES.map((v) => (
                  <label key={v} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={draft.useCases.includes(v)} onChange={(e) => toggleIn("useCases", v, e.target.checked)} />
                    {tOpt(`useCase.${v}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="space-y-1.5">
              <Label htmlFor="lp-access">{t("accessMode")}</Label>
              <select
                id="lp-access"
                value={draft.accessMode}
                onChange={(e) => set("accessMode", e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {DATASET_ACCESS_MODES.map((v) => (
                  <option key={v} value={v}>
                    {tOpt(`access.${v}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-end gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={draft.isOfficial} onChange={(e) => set("isOfficial", e.target.checked)} />
                {tOpt("quality.official")}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={draft.metadataVerified} onChange={(e) => set("metadataVerified", e.target.checked)} />
                {tOpt("quality.verified")}
              </label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lp-scale">{t("scaleSummary")}</Label>
              <Input id="lp-scale" maxLength={200} placeholder={t("scalePlaceholder")} value={draft.scaleSummary ?? ""} onChange={(e) => set("scaleSummary", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lp-lang">{t("languageScope")}</Label>
              <Input id="lp-lang" maxLength={200} placeholder={t("languagePlaceholder")} value={draft.languageScope ?? ""} onChange={(e) => set("languageScope", e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="lp-tags">{t("tags")}</Label>
              <Input id="lp-tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lp-cover">{t("cover")}</Label>
              <Input id="lp-cover" type="url" value={draft.cover ?? ""} onChange={(e) => set("cover", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lp-link">{t("link")}</Label>
              <Input id="lp-link" type="url" value={draft.link ?? ""} onChange={(e) => set("link", e.target.value)} />
              <p className="text-xs text-muted-foreground">{t("linkHint")}</p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="lp-notes">{t("usageNotes")}</Label>
              <Textarea id="lp-notes" rows={4} maxLength={5000} value={draft.usageNotes ?? ""} onChange={(e) => set("usageNotes", e.target.value)} />
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {t("save")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
