import { Box } from "lucide-react";
import { isEmbeddableModel3dViewerUrl } from "@/lib/search/model3d";

type Model3dCardProps = {
  url: string;
  entryName: string;
  modelLabel: string;
};

export function Model3dCard({
  url,
  entryName,
  modelLabel,
}: Model3dCardProps) {
  const canEmbed = isEmbeddableModel3dViewerUrl(url);

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
