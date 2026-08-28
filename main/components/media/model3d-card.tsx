import { Box, ExternalLink } from "lucide-react";

type Model3dCardProps = {
  url: string;
  entryName: string;
  modelLabel: string;
  openLabel: string;
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
  openLabel,
}: Model3dCardProps) {
  const canEmbed = isViewerPage(url);

  return (
    <div className="max-w-3xl overflow-hidden rounded-lg border border-border bg-muted/20">
      {canEmbed && (
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
      )}

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-3 border-t border-border px-4 py-3 transition-colors hover:bg-primary/5"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Box className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">
            {modelLabel}
          </span>
          <span className="block text-xs text-muted-foreground">{openLabel}</span>
        </span>
        <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
      </a>
    </div>
  );
}
