import { Box } from "lucide-react";

type Model3dCardProps = {
  url: string;
  entryName: string;
  modelLabel: string;
};

function isViewerPage(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return !/\.(?:glb|gltf|usdz)$/.test(pathname);
  } catch {
    return false;
  }
}

export function Model3dCard({
  url,
  entryName,
  modelLabel,
}: Model3dCardProps) {
  const canEmbed = isViewerPage(url);

  return (
    <div className="max-w-3xl overflow-hidden rounded-lg border border-border bg-muted/20">
      {canEmbed ? (
        <div className="aspect-video w-full bg-muted/30">
          <iframe
            src={url}
            title={`${entryName} · ${modelLabel}`}
            loading="lazy"
            allow="fullscreen; xr-spatial-tracking"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin"
            referrerPolicy="no-referrer"
            className="h-full w-full border-0"
          />
        </div>
      ) : (
        <div className="flex aspect-video items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
          <Box className="h-5 w-5" />
          {modelLabel}
        </div>
      )}
    </div>
  );
}
