type AudioCardProps = {
  url: string;
  openSourceLabel: string;
};

export function AudioCard({ url, openSourceLabel }: AudioCardProps) {
  return (
    <div className="flex w-full max-w-3xl flex-wrap items-center gap-x-4 gap-y-2">
      <audio
        src={url}
        controls
        preload="metadata"
        className="h-10 min-w-0 flex-1"
      />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        {openSourceLabel}
      </a>
    </div>
  );
}
