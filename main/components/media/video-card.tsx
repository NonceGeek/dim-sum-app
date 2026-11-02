import { VideoPlayer, type VideoAnalytics } from "./video-player";

type VideoCardProps = {
  url: string;
  poster?: string | null;
  transcript?: string | null;
  transcriptLabel: string;
  analytics?: VideoAnalytics;
};

export function VideoCard({
  url,
  poster,
  transcript,
  transcriptLabel,
  analytics,
}: VideoCardProps) {
  return (
    <div className="space-y-3">
      <VideoPlayer url={url} poster={poster} analytics={analytics} />

      {transcript && (
        <details open className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm">
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
