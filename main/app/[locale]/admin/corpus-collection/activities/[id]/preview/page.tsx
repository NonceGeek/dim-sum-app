"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  FileText,
  Hash,
  ImageIcon,
  Settings,
  Trophy,
  Users,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type Activity = {
  id: string;
  displayUuid: string;
  title: string;
  slug?: string | null;
  description?: string | null;
  rules?: string | null;
  category?: string | null;
  tags: string[];
  submissionTypes: string[];
  rewardConfig?: unknown;
  mediaRequirements?: unknown;
  bannerUrl?: string | null;
  status: string;
  timeStatus?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  canSubmit?: boolean;
  submissionCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

const statusColor: Record<string, string> = {
  draft: "bg-secondary text-secondary-foreground",
  published: "bg-success text-success-foreground",
  offline: "bg-warning text-warning-foreground",
  archived: "bg-muted text-muted-foreground",
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return format(new Date(value), "MMM d, yyyy HH:mm");
}

function JsonBlock({ value }: { value: unknown }) {
  if (
    value === undefined ||
    value === null ||
    (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0)
  ) {
    return <div className="text-sm text-muted-foreground">No data</div>;
  }

  return (
    <pre className="max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function CorpusCollectionActivityPreviewPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const { data, isLoading, error } = useQuery<Activity>({
    queryKey: ["corpus-collection-activity-preview", id],
    queryFn: async () => {
      const response = await fetch(`/api/admin/corpus-collection/activities/${id}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to load activity");
      }
      return response.json();
    },
    enabled: Boolean(id),
  });

  const activityWindow = useMemo(() => {
    if (!data) return "-";
    return `${formatDate(data.startsAt)} - ${formatDate(data.endsAt)}`;
  }, [data]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading activity preview...</div>;
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline">
          <Link href="/admin/corpus-collection/activities">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            {error instanceof Error ? error.message : "Activity not found"}
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
            <Link href="/admin/corpus-collection/activities">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to activities
            </Link>
          </Button>
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge className={statusColor[data.status] ?? "bg-secondary"}>{data.status}</Badge>
              {data.timeStatus && <Badge variant="outline">{data.timeStatus}</Badge>}
              {data.canSubmit && <Badge variant="outline">Can submit</Badge>}
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">{data.title}</h2>
            <p className="mt-2 max-w-3xl text-muted-foreground">{data.description || "No description"}</p>
          </div>
        </div>
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-right">
          <div className="text-xs text-muted-foreground">Activity UUID</div>
          <code className="text-xs text-foreground">{data.displayUuid}</code>
        </div>
      </div>

      <Card className="overflow-hidden">
        {data.bannerUrl ? (
          <div className="relative bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.bannerUrl} alt="" className="aspect-[16/7] w-full object-cover" />
          </div>
        ) : (
          <div className="flex aspect-[16/7] items-center justify-center bg-muted text-muted-foreground">
            <ImageIcon className="mr-2 h-5 w-5" />
            No banner
          </div>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Public Copy</CardTitle>
              <CardDescription>Text users will read before submitting.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4" />
                  Description
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{data.description || "-"}</p>
              </div>
              <Separator />
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <ClipboardList className="h-4 w-4" />
                  Rules
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{data.rules || "-"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Reward and media requirement payloads.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Trophy className="h-4 w-4" />
                  Reward Config
                </div>
                <JsonBlock value={data.rewardConfig} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Settings className="h-4 w-4" />
                  Media Requirements
                </div>
                <JsonBlock value={data.mediaRequirements} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>ID {data.id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">UUID</span>
                <code className="text-xs">{data.displayUuid}</code>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Slug</span>
                <span>{data.slug || "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Category</span>
                <span>{data.category || "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  Window
                </span>
                <span className="text-right">{activityWindow}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  Submissions
                </span>
                <span>{data.submissionCount ?? 0}</span>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Hash className="h-4 w-4" />
                  Tags
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.tags?.length ? data.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>) : <span className="text-muted-foreground">-</span>}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-muted-foreground">Submission Types</div>
                <div className="flex flex-wrap gap-2">
                  {data.submissionTypes?.length ? data.submissionTypes.map((type) => <Badge key={type} variant="outline">{type}</Badge>) : <span className="text-muted-foreground">-</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
