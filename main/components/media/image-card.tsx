"use client";

import Link from "next/link";
import { useState } from "react";

type ImageCardProps = {
  url: string;
  alt: string;
  openSourceLabel: string;
  unavailableLabel: string;
  detailHref?: string;
};

export function ImageCard({
  url,
  alt,
  openSourceLabel,
  unavailableLabel,
  detailHref,
}: ImageCardProps) {
  const [loadFailed, setLoadFailed] = useState(false);

  const image = loadFailed ? (
    <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-border bg-muted/30 px-4 text-center text-sm text-muted-foreground">
      {unavailableLabel}
    </div>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setLoadFailed(true)}
      className="max-h-[420px] w-full rounded-md border border-border bg-muted/30 object-contain"
    />
  );

  return (
    <div className="space-y-2">
      {detailHref && !loadFailed ? (
        <Link href={detailHref} className="block">
          {image}
        </Link>
      ) : (
        image
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        {openSourceLabel}
      </a>
    </div>
  );
}
