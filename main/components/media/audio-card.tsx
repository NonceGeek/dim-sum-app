type AudioCardProps = { url: string };

export function AudioCard({ url }: AudioCardProps) {
  return (
    <audio
      src={url}
      controls
      preload="metadata"
      className="h-10 w-full max-w-3xl"
    />
  );
}
