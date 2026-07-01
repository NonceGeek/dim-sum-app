"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

type CopyEntryIdButtonProps = {
  entryId: string;
};

export function CopyEntryIdButton({ entryId }: CopyEntryIdButtonProps) {
  const t = useTranslations("EntryDetail");

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(entryId);
        toast.success(t("copied"));
      }}
      className="inline-flex max-w-full items-center gap-1 rounded border border-border px-1.5 py-0.5 font-mono text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <span className="truncate">{entryId}</span>
      <Copy className="h-3 w-3 shrink-0" />
    </button>
  );
}
