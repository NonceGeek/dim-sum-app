"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Video, QrCode } from "lucide-react";
import { toast } from "sonner";
import type { ChannelVideo } from "@/lib/channel-video";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ChannelVideoCard({ video, coverUrl, submissionId }: { video: ChannelVideo; coverUrl?: string | null; submissionId: string }) {
  const t = useTranslations("ChannelVideo");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [environment, setEnvironment] = useState("release");
  useEffect(() => { setCode(""); setError(""); }, [submissionId, video.finderUserName, video.feedId]);
  async function generate() {
    setLoading(true); setError(""); setCode("");
    try {
      const response = await fetch(`/api/admin/corpus-collection/submissions/${submissionId}/channel-code?env=${environment}`, { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.image) throw new Error(result.error || t("codeFailed"));
      setCode(result.image);
    } catch (error) {
      setError(error instanceof Error ? error.message : t("codeFailed"));
    } finally { setLoading(false); }
  }
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
        <div className="space-y-3 rounded-md border p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={environment} disabled={loading} onValueChange={(value) => { setEnvironment(value); setCode(""); setError(""); }}>
              <SelectTrigger aria-label={t("codeEnvironment")} className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="release">{t("release")}</SelectItem>
                <SelectItem value="trial">{t("trial")}</SelectItem>
                <SelectItem value="develop">{t("develop")}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" disabled={loading} onClick={generate}><QrCode className="mr-2 h-4 w-4" />{loading ? t("generating") : t("scanVideo")}</Button>
          </div>
          {environment !== "release" && <p className="text-sm text-muted-foreground">{t("trialHint")}</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {code && <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={code} alt={t("scanVideo")} className="h-56 w-56 rounded-md bg-white" />
            <p className="text-sm text-muted-foreground">{t("scanHint")}</p>
          </div>}
        </div>
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
