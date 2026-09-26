"use client";

import { useTranslations } from "next-intl";
import { Video } from "lucide-react";
import { toast } from "sonner";
import type { ChannelVideo } from "@/lib/channel-video";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ChannelVideoCard({ video, coverUrl }: { video: ChannelVideo; coverUrl?: string | null }) {
  const t = useTranslations("ChannelVideo");
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Video className="h-5 w-5" />{t("title")}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt={t("cover")} className="max-h-64 rounded-md object-contain" />
        ) : (
          <div className="flex h-32 items-center justify-center rounded-md bg-muted text-muted-foreground"><Video className="mr-2 h-6 w-6" />{t("noCover")}</div>
        )}
        <p className="text-sm text-muted-foreground">{t("manualReview")}</p>
        <dl className="space-y-3">
          {(["finderUserName", "feedId"] as const).map((key) => (
            <div key={key}>
              <dt className="text-sm font-medium">{t(key)}</dt>
              <dd className="flex items-start gap-2"><code className="min-w-0 flex-1 break-all text-sm">{video[key]}</code><Button size="sm" variant="outline" onClick={() => copy(video[key])}>{t("copy")}</Button></dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted-foreground">{t("ownership")}</p>
        <p className="text-sm text-muted-foreground">{t("viewing")}</p>
      </CardContent>
    </Card>
  );
}
