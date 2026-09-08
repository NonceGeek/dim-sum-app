type VideoCardProps = {
  url: string;
  poster?: string | null;
  transcript?: string | null;
  transcriptLabel: string;
};

export function VideoCard({
  url,
  poster,
  transcript,
  transcriptLabel,
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

      {transcript && (
        <details className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium text-foreground">
            {transcriptLabel}
          </summary>
          <p className="mt-3 whitespace-pre-wrap break-words leading-7 text-muted-foreground">
            {transcript}
          </p>
        </details>
      )}
    </div>
  );
}
