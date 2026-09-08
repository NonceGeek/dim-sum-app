"use client";

import { Maximize2 } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ImageCardProps = {
  url: string;
  alt: string;
  previewLabel: string;
  unavailableLabel: string;
  compact?: boolean;
};

export function ImageCard({
  url,
  alt,
  previewLabel,
  unavailableLabel,
  compact = false,
}: ImageCardProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const [open, setOpen] = useState(false);

  if (loadFailed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md border border-dashed border-border bg-muted/30 px-4 text-center text-sm text-muted-foreground",
          compact ? "h-24" : "aspect-video",
        )}
      >
        {unavailableLabel}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={previewLabel}
        className={cn(
          "group/image relative block w-full overflow-hidden rounded-md border border-border bg-muted/30 text-left",
          compact ? "h-24" : "max-h-[420px]",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={alt}
          loading="lazy"
          onError={() => setLoadFailed(true)}
          className={cn(
            "w-full",
            compact ? "h-full object-cover" : "max-h-[420px] object-contain",
          )}
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-all group-hover/image:bg-black/25 group-hover/image:opacity-100 group-focus-visible/image:bg-black/25 group-focus-visible/image:opacity-100">
          <span className="flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1.5 text-xs font-medium">
            <Maximize2 className="h-3.5 w-3.5" />
            {previewLabel}
          </span>
        </span>
      </button>

      <DialogContent className="max-w-[min(94vw,1100px)] border-white/10 bg-black/95 p-3 text-white sm:rounded-xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{alt}</DialogTitle>
          <DialogDescription>{previewLabel}</DialogDescription>
        </DialogHeader>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={alt}
          className="max-h-[85vh] w-full object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}
