type VideoCardProps = {
  url: string;
  poster?: string | null;
  transcript?: string | null;
  transcriptLabel: string;
  openSourceLabel: string;
};

export function VideoCard({
  url,
  poster,
  transcript,
  transcriptLabel,
  openSourceLabel,
}: VideoCardProps) {
  return (
    <div className="space-y-3">
      <video
        src={url}
        controls
        preload="metadata"
        playsInline
        poster={poster ?? undefined}
        className="aspect-video w-full rounded-md border border-border bg-muted/30 object-contain"
      />

      <div className="flex flex-wrap items-start justify-between gap-3 text-sm">
        {transcript ? (
          <details className="min-w-0 flex-1 rounded-md border border-border/70 bg-muted/20 px-3 py-2">
            <summary className="cursor-pointer font-medium text-foreground">
              {transcriptLabel}
            </summary>
            <p className="mt-3 whitespace-pre-wrap break-words leading-7 text-muted-foreground">
              {transcript}
            </p>
          </details>
        ) : (
          <span />
        )}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 py-2 font-medium text-primary underline-offset-4 hover:underline"
        >
          {openSourceLabel}
        </a>
      </div>
    </div>
  );
}
