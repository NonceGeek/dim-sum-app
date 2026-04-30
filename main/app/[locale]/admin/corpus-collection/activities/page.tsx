"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarDays, Image, Loader2, Plus, Search } from "lucide-react";
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
  title: string;
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

const statusColor: Record<string, string> = {
  draft: "bg-secondary text-secondary-foreground",
  published: "bg-success text-success-foreground",
  offline: "bg-warning text-warning-foreground",
  archived: "bg-muted text-muted-foreground",
};

export default function CorpusCollectionActivitiesPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    rules: "",
    startsAt: "",
    endsAt: "",
    bannerUrl: "",
  });
  const [coverPrompt, setCoverPrompt] = useState("");
  const [covers, setCovers] = useState<CoverResponse | null>(null);

  const { data, isLoading } = useQuery<ActivitiesResponse>({
    queryKey: ["corpus-collection-activities", status, q],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "50" });
      if (status !== "all") params.set("status", status);
      if (q) params.set("q", q);
      const response = await fetch(`/api/admin/corpus-collection/activities?${params}`);
      if (!response.ok) throw new Error("Failed to load activities");
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
          startsAt: form.startsAt || undefined,
          endsAt: form.endsAt || undefined,
          bannerUrl: form.bannerUrl || undefined,
          mediaRequirements: {
            images: { required: true, min: 1, max: 9 },
            audio: { required: true, maxDurationSec: 60 },
            video: { required: false, maxDurationSec: 30 },
          },
        }),
      });
      if (!response.ok) throw new Error("Failed to create activity");
      return response.json();
    },
    onSuccess: () => {
      toast.success("Activity created");
      setForm({ title: "", description: "", rules: "", startsAt: "", endsAt: "", bannerUrl: "" });
      queryClient.invalidateQueries({ queryKey: ["corpus-collection-activities"] });
    },
    onError: () => toast.error("Failed to create activity"),
  });

  const setStatusMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "publish" | "offline" }) => {
      const response = await fetch(`/api/admin/corpus-collection/activities/${id}/${action}`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to update status");
      return response.json();
    },
    onSuccess: () => {
      toast.success("Activity status updated");
      queryClient.invalidateQueries({ queryKey: ["corpus-collection-activities"] });
    },
    onError: () => toast.error("Failed to update activity status"),
  });

  const coverMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/corpus-collection/covers/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: coverPrompt }),
      });
      if (!response.ok) throw new Error("Failed to generate covers");
      return response.json() as Promise<CoverResponse>;
    },
    onSuccess: (result) => {
      setCovers(result);
      toast.success("Cover candidates generated");
    },
    onError: () => toast.error("Failed to generate cover candidates"),
  });

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Activities</h2>
        <p className="text-muted-foreground mt-2">
          Create collection campaigns, generate banners, and manage publishing state.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Create Activity</CardTitle>
            <CardDescription>Configure a new public collection campaign.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
              <div className="space-y-2 md:col-span-2">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Rules</Label>
                <Textarea value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Starts At</Label>
                <Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Ends At</Label>
                <Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Banner URL</Label>
                <Input value={form.bannerUrl} onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Create
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>AI Banner</CardTitle>
            <CardDescription>Generate temporary cover candidates from a prompt.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="粤语童谣月光光主题活动，温馨童趣，荔湾骑楼..."
              value={coverPrompt}
              onChange={(e) => setCoverPrompt(e.target.value)}
            />
            <Button onClick={() => coverMutation.mutate()} disabled={!coverPrompt || coverMutation.isPending}>
              {coverMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Image className="mr-2 h-4 w-4" />}
              Generate
            </Button>
            {covers && (
              <div className="grid gap-3">
                {covers.images.map((image) => (
                  <button
                    key={image.index}
                    type="button"
                    className="overflow-hidden rounded-md border text-left"
                    onClick={() => {
                      setForm({ ...form, bannerUrl: image.url });
                      toast.success("Candidate URL copied into the banner field");
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.url} alt={`Candidate ${image.index}`} className="aspect-video w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Activity List</CardTitle>
          <CardDescription>Filter and publish collection campaigns.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search activities" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Submissions</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5}>Loading...</TableCell></TableRow>
              ) : data?.items.length ? (
                data.items.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{activity.title}</div>
                      <div className="text-sm text-muted-foreground line-clamp-1">{activity.description || "-"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColor[activity.status] ?? "bg-secondary"}>{activity.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        {activity.startsAt ? format(new Date(activity.startsAt), "MMM d") : "Anytime"} - {activity.endsAt ? format(new Date(activity.endsAt), "MMM d") : "Open"}
                      </div>
                    </TableCell>
                    <TableCell>{activity.submissionCount ?? 0}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setStatusMutation.mutate({ id: activity.id, action: "publish" })}>Publish</Button>
                        <Button size="sm" variant="outline" onClick={() => setStatusMutation.mutate({ id: activity.id, action: "offline" })}>Offline</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5}>No activities found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
