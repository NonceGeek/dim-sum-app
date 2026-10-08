"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { MotionConfig } from "motion/react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { VideoPlayer } from "./video-player";

type CardVideoPreviewProps = {
  url: string;
  poster?: string | null;
  title: string;
};

export function CardVideoPreview(props: CardVideoPreviewProps) {
  return <Preview key={props.url} {...props} />;
}

function Preview({ url, poster, title }: CardVideoPreviewProps) {
  const t = useTranslations("VideoPlayer");
  const [open, setOpen] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  return (
    <MotionConfig reducedMotion="user">
      <Dialog open={open} onOpenChange={setOpen}>
        <div ref={previewRef}>
          <VideoPlayer url={url} poster={poster} compact onPreview={() => setOpen(true)} onAspectRatio={setAspectRatio} />
        </div>
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] max-w-none gap-0 overflow-y-auto border-border bg-background p-0 text-foreground sm:max-w-none"
          style={{
            width: `min(calc(100vw - 2rem), 1100px, calc(min(72dvh, 720px, calc(100dvh - 9rem)) * ${aspectRatio} + 2rem))`,
            minWidth: "min(20rem, calc(100vw - 2rem))",
          }}
          showCloseButton={false}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            closeRef.current?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            previewRef.current?.querySelector("button")?.focus({ preventScroll: true });
          }}
        >
          <div className="flex items-start gap-3 p-4">
            <DialogHeader className="min-w-0 flex-1 text-left">
              <DialogTitle className="line-clamp-2 break-words text-base leading-6" title={title}>{title}</DialogTitle>
              <DialogDescription className="sr-only">{t("dialogDescription")}</DialogDescription>
            </DialogHeader>
            <DialogClose asChild>
              <Button ref={closeRef} type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label={t("close")}>
                <X aria-hidden="true" />
              </Button>
            </DialogClose>
          </div>
          <div className="px-4 pb-4">
            {/* Unmount immediately on close, including during the exit animation. */}
            {open && <VideoPlayer url={url} poster={poster} autoPlay enlarged onAspectRatio={setAspectRatio} />}
          </div>
        </DialogContent>
      </Dialog>
    </MotionConfig>
  );
}
