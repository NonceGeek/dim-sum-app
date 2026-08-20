"use client";

import { FormEvent, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, Copy, Eye, Image, Loader2, Plus, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type Activity = {
  id: string;
  displayUuid: string;
  title: string;
  tags?: string[];
  description?: string | null;
  rules?: string | null;
  bannerUrl?: string | null;
  status: string;
  startsAt?: string | null;
  endsAt?: string | null;
  submissionCount?: number;
};

type ActivitiesResponse = {
  items: Activity[];
  pagination: { page: number; pageSize: number; total: number };
};

type CoverResponse = {
  generationId: string;
  images: Array<{ index: number; url: string; expiresAt: string }>;
  size: string;
};

type MediaType = "image" | "video" | "audio";

const textLimits = {
  title: 20,
  tag: 4,
  description: 100,
  rules: 100,
} as const;

const statusColor: Record<string, string> = {
  draft: "bg-secondary text-secondary-foreground",
  published: "bg-success text-success-foreground",
  offline: "bg-warning text-warning-foreground",
  archived: "bg-muted text-muted-foreground",
};

function countCharacters(value: string) {
  return Array.from(value.trim()).length;
}

export default function CorpusCollectionActivitiesPage() {
  const t = useTranslations("CorpusCollectionActivities");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const dateLocale = locale === "zh-CN" ? "zh-CN" : "en-US";
  const mediaTypeOptions: Array<{ value: MediaType; label: string; description: string }> = [
    { value: "image", label: t("media.image.label"), description: t("media.image.description") },
    { value: "video", label: t("media.video.label"), description: t("media.video.description") },
    { value: "audio", label: t("media.audio.label"), description: t("media.audio.description") },
  ];
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [qMode, setQMode] = useState("title");
  const [form, setForm] = useState({
    title: "",
    tag: "",
    description: "",
    rules: "",
    startsAt: "",
    endsAt: "",
    bannerUrl: "",
    requiredMediaTypes: ["image"] as MediaType[],
  });
  const [coverPrompt, setCoverPrompt] = useState("");
  const [covers, setCovers] = useState<CoverResponse | null>(null);
  const [uploadingCoverUrl, setUploadingCoverUrl] = useState<string | null>(null);
  const [savedCoverUrls, setSavedCoverUrls] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery<ActivitiesResponse>({
    queryKey: ["corpus-collection-activities", status, q, qMode],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "50" });
      if (status !== "all") params.set("status", status);
      if (q) params.set("q", q);
      if (q) params.set("qMode", qMode);
      const response = await fetch(`/api/admin/corpus-collection/activities?${params}`);
      if (!response.ok) throw new Error(t("errors.load"));
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/corpus-collection/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tags: [form.tag.trim()],
          tag: undefined,
          startsAt: form.startsAt || undefined,
          endsAt: form.endsAt || undefined,
          bannerUrl: form.bannerUrl || undefined,
          requiredMediaTypes: undefined,
          mediaRequirements: { requiredTypes: form.requiredMediaTypes },
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || t("errors.create"));
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success(t("messages.created"));
      setForm({
        title: "",
        tag: "",
        description: "",
        rules: "",
        startsAt: "",
        endsAt: "",
        bannerUrl: "",
        requiredMediaTypes: ["image"],
      });
      queryClient.invalidateQueries({ queryKey: ["corpus-collection-activities"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("errors.create")),
  });

  const setStatusMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "publish" | "offline" }) => {
      const response = await fetch(`/api/admin/corpus-collection/activities/${id}/${action}`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(t("errors.status"));
      return response.json();
    },
    onSuccess: () => {
      toast.success(t("messages.statusUpdated"));
      queryClient.invalidateQueries({ queryKey: ["corpus-collection-activities"] });
    },
    onError: () => toast.error(t("errors.status")),
  });

  const coverMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/corpus-collection/covers/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: coverPrompt }),
      });
      if (!response.ok) throw new Error(t("errors.generate"));
      return response.json() as Promise<CoverResponse>;
    },
    onSuccess: (result) => {
      setCovers(result);
      setSavedCoverUrls({});
      toast.success(t("messages.generated"));
    },
    onError: () => toast.error(t("errors.generate")),
  });

  const selectCoverMutation = useMutation({
    mutationFn: async (url: string) => {
      setUploadingCoverUrl(url);
      const response = await fetch("/api/admin/corpus-collection/covers/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) throw new Error(t("errors.upload"));
      return response.json() as Promise<{ url: string }>;
    },
    onSuccess: (result, sourceUrl) => {
      setForm((current) => ({ ...current, bannerUrl: result.url }));
      setSavedCoverUrls((current) => ({ ...current, [sourceUrl]: result.url }));
      toast.success(t("messages.uploaded"));
    },
    onError: () => toast.error(t("errors.upload")),
    onSettled: () => setUploadingCoverUrl(null),
  });

  const toggleMediaType = (type: MediaType, checked: boolean) => {
    setForm((current) => {
      const requiredMediaTypes = checked
        ? Array.from(new Set([...current.requiredMediaTypes, type]))
        : current.requiredMediaTypes.filter((item) => item !== type);
      return { ...current, requiredMediaTypes };
    });
  };

  const copyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success(t("messages.copied"));
  };

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim()) {
      toast.error(t("validation.titleRequired"));
      return;
    }
    if (countCharacters(form.title) > textLimits.title) {
      toast.error(t("validation.titleLength", { count: textLimits.title }));
      return;
    }
    if (!form.tag.trim()) {
      toast.error(t("validation.tagRequired"));
      return;
    }
    if (countCharacters(form.tag) !== textLimits.tag) {
      toast.error(t("validation.tagLength", { count: textLimits.tag }));
      return;
    }
    if (countCharacters(form.description) > textLimits.description) {
      toast.error(t("validation.descriptionLength", { count: textLimits.description }));
      return;
    }
    if (countCharacters(form.rules) > textLimits.rules) {
      toast.error(t("validation.rulesLength", { count: textLimits.rules }));
      return;
    }
    if (form.startsAt && form.endsAt && new Date(form.startsAt) >= new Date(form.endsAt)) {
      toast.error(t("validation.dateOrder"));
      return;
    }
    if (form.requiredMediaTypes.length < 1) {
      toast.error(t("validation.mediaRequired"));
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">{t("title")}</h2>
        <p className="text-muted-foreground mt-2">
          {t("description")}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>{t("create.title")}</CardTitle>
            <CardDescription>{t("create.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>{t("fields.title")}</Label>
                  <span className="text-xs text-muted-foreground">
                    {countCharacters(form.title)}/{textLimits.title}
                  </span>
                </div>
                <Input
                  value={form.title}
                  maxLength={textLimits.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>{t("fields.tag")}</Label>
                  <span className="text-xs text-muted-foreground">
                    {countCharacters(form.tag)}/{textLimits.tag}
                  </span>
                </div>
                <Input
                  value={form.tag}
                  maxLength={textLimits.tag}
                  placeholder={t("fields.tagPlaceholder")}
                  onChange={(e) => setForm({ ...form, tag: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  {t("fields.tagHelp")}
                </p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>{t("fields.description")}</Label>
                  <span className="text-xs text-muted-foreground">
                    {countCharacters(form.description)}/{textLimits.description}
                  </span>
                </div>
                <Textarea
                  value={form.description}
                  maxLength={textLimits.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>{t("fields.rules")}</Label>
                  <span className="text-xs text-muted-foreground">
                    {countCharacters(form.rules)}/{textLimits.rules}
                  </span>
                </div>
                <Textarea
                  value={form.rules}
                  maxLength={textLimits.rules}
                  onChange={(e) => setForm({ ...form, rules: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("fields.startsAt")}</Label>
                <Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t("fields.endsAt")}</Label>
                <Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{t("fields.bannerUrl")}</Label>
                <Input value={form.bannerUrl} onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })} />
              </div>
              <div className="space-y-3 md:col-span-2">
                <div>
                  <Label>{t("fields.requiredMediaTypes")}</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("fields.mediaHelp")}
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {mediaTypeOptions.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-start gap-3 rounded-md border bg-background p-3"
                    >
                      <Checkbox
                        checked={form.requiredMediaTypes.includes(option.value)}
                        onCheckedChange={(checked) => toggleMediaType(option.value, checked === true)}
                      />
                      <span className="space-y-1">
                        <span className="block text-sm font-medium text-foreground">{option.label}</span>
                        <span className="block text-xs leading-5 text-muted-foreground">{option.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  {t("actions.create")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>{t("banner.title")}</CardTitle>
            <CardDescription>
              {t("banner.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder={t("banner.promptPlaceholder")}
              value={coverPrompt}
              onChange={(e) => setCoverPrompt(e.target.value)}
            />
            <Button onClick={() => coverMutation.mutate()} disabled={!coverPrompt || coverMutation.isPending}>
              {coverMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Image className="mr-2 h-4 w-4" />}
              {t("actions.generate")}
            </Button>
            {covers && (
              <div className="grid gap-3">
                {covers.images.map((image) => {
                  const uploadedUrl = savedCoverUrls[image.url];
                  return (
                    <div key={image.index} className="overflow-hidden rounded-md border bg-background">
                      <div className="bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image.url} alt={t("banner.candidateAlt", { index: image.index + 1 })} className="aspect-video w-full object-cover" />
                      </div>
                      <div className="space-y-3 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-foreground">{t("banner.candidate", { index: image.index + 1 })}</div>
                            <div className="text-xs text-muted-foreground">{t("banner.expires", { date: new Intl.DateTimeFormat(dateLocale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(image.expiresAt)) })}</div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => selectCoverMutation.mutate(image.url)}
                            disabled={selectCoverMutation.isPending}
                          >
                            {uploadingCoverUrl === image.url ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="mr-2 h-4 w-4" />
                            )}
                            {t("actions.uploadOss")}
                          </Button>
                        </div>
                        {uploadedUrl && (
                          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                              <Check className="h-4 w-4 text-success" />
                              {t("banner.permanentUrl")}
                            </div>
                            <div className="flex gap-2">
                              <Input readOnly value={uploadedUrl} className="font-mono text-xs" />
                              <Button type="button" variant="outline" size="icon" onClick={() => copyUrl(uploadedUrl)}>
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                            <p className="text-xs leading-5 text-muted-foreground">
                              {t("banner.urlHelp")}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>{t("list.title")}</CardTitle>
          <CardDescription>{t("list.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-10"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={qMode === "activityUuid" ? t("filters.uuidPlaceholder") : t("filters.titlePlaceholder")}
              />
            </div>
            <Select value={qMode} onValueChange={setQMode}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="title">{t("filters.titleContains")}</SelectItem>
                <SelectItem value="activityUuid">{t("filters.activityUuid")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("status.all")}</SelectItem>
                <SelectItem value="draft">{t("status.draft")}</SelectItem>
                <SelectItem value="published">{t("status.published")}</SelectItem>
                <SelectItem value="offline">{t("status.offline")}</SelectItem>
                <SelectItem value="archived">{t("status.archived")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.title")}</TableHead>
                <TableHead>{t("columns.uuid")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead>{t("columns.window")}</TableHead>
                <TableHead>{t("columns.submissions")}</TableHead>
                <TableHead>{t("columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6}>{t("loading")}</TableCell></TableRow>
              ) : data?.items.length ? (
                data.items.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{activity.title}</div>
                      {activity.tags?.[0] && (
                        <Badge variant="secondary" className="mt-1">
                          {activity.tags[0]}
                        </Badge>
                      )}
                      <div className="text-sm text-muted-foreground line-clamp-1">{activity.description || "-"}</div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs text-muted-foreground">{activity.displayUuid}</code>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColor[activity.status] ?? "bg-secondary"}>{t(`status.`)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        {activity.startsAt ? new Intl.DateTimeFormat(dateLocale, { month: "short", day: "numeric" }).format(new Date(activity.startsAt)) : t("window.anytime")} - {activity.endsAt ? new Intl.DateTimeFormat(dateLocale, { month: "short", day: "numeric" }).format(new Date(activity.endsAt)) : t("window.open")}
                      </div>
                    </TableCell>
                    <TableCell>{activity.submissionCount ?? 0}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`/${locale}/admin/corpus-collection/activities/${activity.id}/preview`, "_blank")}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          {t("actions.preview")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setStatusMutation.mutate({ id: activity.id, action: "publish" })}>{t("actions.publish")}</Button>
                        <Button size="sm" variant="outline" onClick={() => setStatusMutation.mutate({ id: activity.id, action: "offline" })}>{t("status.offline")}</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6}>{t("empty")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
