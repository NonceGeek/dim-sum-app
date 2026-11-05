"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { datasetContactRequestSchema } from "@/lib/library/options";

const EMPTY = { contactName: "", contactEmail: "", organizationName: "", message: "", website: "" };

export function ContactRequestDialog({
  slug,
  requestType,
  open,
  onOpenChange,
}: {
  slug: string;
  requestType: "access_request" | "contact";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Library.contact");
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof EMPTY) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, datasetSlug: slug, requestType };
    if (!datasetContactRequestSchema.safeParse(payload).success)
      return toast.error(t("required"));
    setBusy(true);
    try {
      const res = await fetch("/api/public/dataset-contact-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error);
      }
      toast.success(t("success"));
      setForm(EMPTY);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {requestType === "access_request" ? t("titleAccess") : t("titleContact")}
            </DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cr-name">{t("name")} *</Label>
              <Input id="cr-name" value={form.contactName} onChange={set("contactName")} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cr-email">{t("email")} *</Label>
              <Input id="cr-email" type="email" value={form.contactEmail} onChange={set("contactEmail")} maxLength={200} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cr-org">{t("organization")}</Label>
              <Input id="cr-org" value={form.organizationName} onChange={set("organizationName")} maxLength={200} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cr-msg">{t("message")} *</Label>
              <Textarea
                id="cr-msg"
                rows={4}
                value={form.message}
                onChange={set("message")}
                placeholder={t("messagePlaceholder")}
                maxLength={2000}
              />
            </div>
            {/* Honeypot, hidden from people and assistive tech. */}
            <input
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hidden"
              value={form.website}
              onChange={set("website")}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? t("submitting") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
