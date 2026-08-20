"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  Eye,
  Heart,
  ImageIcon,
  MessageCircle,
  Music,
  Share2,
  User,
  Video,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type Submission = {
  id: string;
  title: string;
  intro: string;
  submissionType: string;
  tags: string[];
  reviewStatus: string;
  reviewReason?: string | null;
  isFeatured: boolean;
  showOnHome: boolean;
  visibility: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;
  isAwarded: boolean;
  awardStatus: string;
  awardInfo?: unknown;
  coverUrl?: string | null;
  imageUrls: string[];
  activity?: { id: string; displayUuid: string; title: string; startsAt?: string | null; endsAt?: string | null } | null;
  author?: { id: string; name?: string | null; avatar?: string | null } | null;
  media: Array<{
    id: string;
    type: string;
    url: string;
    durationSec?: number | null;
    sortOrder?: number | null;
    metadata?: unknown;
  }>;
  precheckResult?: unknown;
  aiReviewResult?: unknown;
  createdAt?: string;
  updatedAt?: string;
};

const statusColor: Record<string, string> = {
  pending_review: "bg-warning text-warning-foreground",
  ai_reviewing: "bg-info text-info-foreground",
  review_needed: "bg-primary text-primary-foreground",
  approved: "bg-success text-success-foreground",
  rejected: "bg-destructive text-destructive-foreground",
};

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function JsonBlock({ value }: { value: unknown }) {
  const t = useTranslations("SubmissionDetail");
  if (
    value === undefined ||
    value === null ||
    (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0)
  ) {
    return <div className="text-sm text-muted-foreground">{t("noData")}</div>;
  }

  return (
    <pre className="max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function MediaPreview({ item }: { item: Submission["media"][number] }) {
  const t = useTranslations("SubmissionDetail");
  if (item.type === "image") {
    return (
      <a href={item.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.url} alt="" className="aspect-video w-full object-cover" />
      </a>
    );
  }

  if (item.type === "audio") {
    return (
      <div className="rounded-md border bg-muted/30 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Music className="h-4 w-4" />
          {t("audio")} {item.durationSec ? `· ${item.durationSec}s` : ""}
        </div>
        <audio controls className="w-full" src={item.url} />
      </div>
    );
  }

  if (item.type === "video") {
    return (
      <div className="overflow-hidden rounded-md border bg-muted">
        <video controls className="aspect-video w-full" src={item.url} />
      </div>
    );
  }

  return (
    <a href={item.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-md border p-3 text-sm">
      <span>{item.type}</span>
      <ExternalLink className="h-4 w-4" />
    </a>
  );
}

export default function CorpusCollectionSubmissionDetailPage() {
  const t = useTranslations("SubmissionDetail");
  const locale = useLocale();
  const statusLabel = (value: string) => t(`status.${value}`);
  const visibilityLabel = (value: string) => t(`visibility.${value}`);
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const { data, isLoading, error } = useQuery<Submission>({
    queryKey: ["corpus-collection-submission", id],
    queryFn: async () => {
      const response = await fetch(`/api/admin/corpus-collection/submissions/${id}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || t("errors.load"));
      }
      return response.json();
    },
    enabled: Boolean(id),
  });

  const mediaGroups = useMemo(() => {
    const items = data?.media ?? [];
    return {
      image: items.filter((item) => item.type === "image"),
      audio: items.filter((item) => item.type === "audio"),
      video: items.filter((item) => item.type === "video"),
      other: items.filter((item) => !["image", "audio", "video"].includes(item.type)),
    };
  }, [data?.media]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t("loading")}</div>;
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline">
          <Link href="/admin/corpus-collection/submissions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("back")}
          </Link>
        </Button>
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            {error instanceof Error ? error.message : t("errors.notFound")}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/corpus-collection/submissions">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("backToSubmissions")}
            </Link>
          </Button>
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge className={statusColor[data.reviewStatus] ?? "bg-secondary"}>{statusLabel(data.reviewStatus)}</Badge>
              <Badge variant="outline">{visibilityLabel(data.visibility)}</Badge>
              {data.isFeatured && <Badge variant="outline">{t("featured")}</Badge>}
              {data.showOnHome && <Badge variant="outline">{t("home")}</Badge>}
              {data.isAwarded && <Badge className="bg-success text-success-foreground">{data.awardStatus}</Badge>}
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">{data.title}</h2>
            <p className="mt-2 max-w-3xl text-muted-foreground">{data.intro}</p>
          </div>
        </div>
        <Button asChild variant="outline">
          <a href={`/api/admin/corpus-collection/submissions/${data.id}`} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            {t("openJson")}
          </a>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("media.title")}</CardTitle>
              <CardDescription>
                {t("media.count", { count: data.media.length })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {mediaGroups.image.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2">
                  {mediaGroups.image.map((item) => <MediaPreview key={item.id} item={item} />)}
                </div>
              )}
              {mediaGroups.audio.map((item) => <MediaPreview key={item.id} item={item} />)}
              {mediaGroups.video.map((item) => <MediaPreview key={item.id} item={item} />)}
              {mediaGroups.other.map((item) => <MediaPreview key={item.id} item={item} />)}
              {data.media.length === 0 && <div className="text-sm text-muted-foreground">{t("media.empty")}</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("review.title")}</CardTitle>
              <CardDescription>{t("review.description")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-medium">{t("review.precheck")}</div>
                <JsonBlock value={data.precheckResult} />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">{t("review.ai")}</div>
                <JsonBlock value={data.aiReviewResult} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("submission")}</CardTitle>
              <CardDescription>ID {data.id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={data.author?.avatar ?? undefined} />
                  <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm font-medium">{data.author?.name || t("unknown")}</div>
                  <div className="text-xs text-muted-foreground">{data.author?.id || "-"}</div>
                </div>
              </div>
              <Separator />
              <div className="grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t("fields.type")}</span>
                  <Badge variant="outline">{data.submissionType}</Badge>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">{t("fields.activity")}</span>
                  <span className="max-w-48 text-right">
                    {data.activity ? (
                      <>
                        {data.activity.title}
                        <br />
                        <code className="text-xs text-muted-foreground">{data.activity.displayUuid}</code>
                      </>
                    ) : (
                      "-"
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t("fields.created")}</span>
                  <span>{formatDate(data.createdAt, locale)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t("fields.updated")}</span>
                  <span>{formatDate(data.updatedAt, locale)}</span>
                </div>
              </div>
              <Separator />
              <div className="flex flex-wrap gap-2">
                {data.tags?.length ? data.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>) : <span className="text-sm text-muted-foreground">{t("noTags")}</span>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("stats.title")}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border p-3">
                <Heart className="mb-2 h-4 w-4 text-muted-foreground" />
                <div className="font-medium">{data.likeCount}</div>
                <div className="text-muted-foreground">{t("stats.likes")}</div>
              </div>
              <div className="rounded-md border p-3">
                <MessageCircle className="mb-2 h-4 w-4 text-muted-foreground" />
                <div className="font-medium">{data.commentCount}</div>
                <div className="text-muted-foreground">{t("stats.comments")}</div>
              </div>
              <div className="rounded-md border p-3">
                <Share2 className="mb-2 h-4 w-4 text-muted-foreground" />
                <div className="font-medium">{data.shareCount}</div>
                <div className="text-muted-foreground">{t("stats.shares")}</div>
              </div>
              <div className="rounded-md border p-3">
                <Eye className="mb-2 h-4 w-4 text-muted-foreground" />
                <div className="font-medium">{data.viewCount}</div>
                <div className="text-muted-foreground">{t("stats.views")}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("files.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground"><ImageIcon className="h-4 w-4" /> {t("files.images")}</span>
                <span>{mediaGroups.image.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground"><Music className="h-4 w-4" /> {t("files.audio")}</span>
                <span>{mediaGroups.audio.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground"><Video className="h-4 w-4" /> {t("files.video")}</span>
                <span>{mediaGroups.video.length}</span>
              </div>
            </CardContent>
          </Card>

          {data.activity && (
            <Card>
              <CardHeader>
                <CardTitle>{t("activityWindow")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span>{formatDate(data.activity.startsAt, locale)} - {formatDate(data.activity.endsAt, locale)}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
