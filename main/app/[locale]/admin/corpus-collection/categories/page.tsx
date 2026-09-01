"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Category = {
  id: string;
  name: string;
  type: string;
  status: string;
  sortOrder: number;
};

type CategoriesResponse = { items: Category[] };

export default function CorpusCollectionCategoriesPage() {
  const t = useTranslations("CorpusCollectionCategories");
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState("all");
  const [form, setForm] = useState({ name: "", type: "tag" });
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const categoryQueryKey = ["corpus-collection-categories", filterType] as const;

  const { data, isLoading } = useQuery<CategoriesResponse>({
    queryKey: categoryQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterType !== "all") params.set("type", filterType);
      const response = await fetch(`/api/admin/corpus-collection/categories?${params}`);
      if (!response.ok) throw new Error("Failed to load categories");
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/corpus-collection/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error("Failed to create category");
      return response.json();
    },
    onSuccess: () => {
      toast.success(t("created"));
      setForm({ name: "", type: "tag" });
      queryClient.invalidateQueries({ queryKey: ["corpus-collection-categories"] });
    },
    onError: () => toast.error(t("createFailed")),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Category> }) => {
      const response = await fetch(`/api/admin/corpus-collection/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error("Failed to update category");
      return response.json();
    },
    onSuccess: () => {
      toast.success(t("updated"));
      queryClient.invalidateQueries({ queryKey: ["corpus-collection-categories"] });
    },
    onError: () => toast.error(t("updateFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/corpus-collection/categories/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete category");
      return response.json();
    },
    onSuccess: () => {
      toast.success(t("deleted"));
      queryClient.invalidateQueries({ queryKey: ["corpus-collection-categories"] });
    },
    onError: () => toast.error(t("deleteFailed")),
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const response = await fetch("/api/admin/corpus-collection/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });
      if (!response.ok) throw new Error("Failed to reorder categories");
      return response.json();
    },
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: categoryQueryKey });
      const previous = queryClient.getQueryData<CategoriesResponse>(categoryQueryKey);
      const itemById = new Map(previous?.items.map((item) => [item.id, item]));
      const items = orderedIds
        .map((id, sortOrder) => {
          const item = itemById.get(id);
          return item ? { ...item, sortOrder } : null;
        })
        .filter((item): item is Category => item !== null);
      queryClient.setQueryData<CategoriesResponse>(categoryQueryKey, { items });
      return { previous };
    },
    onSuccess: () => toast.success(t("reordered")),
    onError: (_error, _orderedIds, context) => {
      if (context?.previous) {
        queryClient.setQueryData(categoryQueryKey, context.previous);
      }
      toast.error(t("reorderFailed"));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["corpus-collection-categories"] });
    },
  });

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error(t("nameRequired"));
      return;
    }
    createMutation.mutate();
  };

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId || !data?.items.length) {
      setDraggedId(null);
      return;
    }
    const reordered = [...data.items];
    const sourceIndex = reordered.findIndex((item) => item.id === draggedId);
    const targetIndex = reordered.findIndex((item) => item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) {
      setDraggedId(null);
      return;
    }
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    setDraggedId(null);
    reorderMutation.mutate(reordered.map((item) => item.id));
  };

  const handleKeyboardReorder = (categoryId: string, direction: -1 | 1) => {
    if (!data?.items.length || reorderMutation.isPending) return;
    const sourceIndex = data.items.findIndex((item) => item.id === categoryId);
    const targetIndex = sourceIndex + direction;
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= data.items.length) return;
    const reordered = [...data.items];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    reorderMutation.mutate(reordered.map((item) => item.id));
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">{t("title")}</h2>
        <p className="text-muted-foreground mt-2">{t("description")}</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>{t("add.title")}</CardTitle>
          <CardDescription>{t("add.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-[1fr_180px_auto]" onSubmit={handleCreate}>
            <div className="space-y-2">
              <Label>{t("name")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("type")}</Label>
              <Select value={form.type} onValueChange={(type) => setForm({ ...form, type })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="submission_type">{t("submissionType")}</SelectItem>
                  <SelectItem value="tag">{t("tag")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                {t("add.button")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>{t("list.title")}</CardTitle>
              <CardDescription>{t("list.description")}</CardDescription>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allTypes")}</SelectItem>
                <SelectItem value="submission_type">{t("submissionType")}</SelectItem>
                <SelectItem value="tag">{t("tag")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("type")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("sort")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5}>{t("loading")}</TableCell></TableRow>
              ) : data?.items.length ? (
                data.items.map((category) => (
                  <TableRow
                    key={category.id}
                    className={draggedId === category.id ? "opacity-50" : undefined}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleDrop(category.id)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span
                          draggable={!reorderMutation.isPending}
                          role="button"
                          tabIndex={0}
                          aria-label={t("dragToSort", { name: category.name })}
                          className="cursor-grab text-muted-foreground active:cursor-grabbing"
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", category.id);
                            setDraggedId(category.id);
                          }}
                          onDragEnd={() => setDraggedId(null)}
                          onKeyDown={(event) => {
                            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                              event.preventDefault();
                              handleKeyboardReorder(category.id, event.key === "ArrowUp" ? -1 : 1);
                            }
                          }}
                        >
                          <GripVertical className="h-4 w-4" />
                        </span>
                        {category.name}
                      </div>
                    </TableCell>
                    <TableCell>{category.type === "submission_type" ? t("submissionType") : t("tag")}</TableCell>
                    <TableCell>
                      <Badge className={category.status === "active" ? "bg-success text-success-foreground" : "bg-secondary text-secondary-foreground"}>
                        {category.status === "active" ? t("active") : t("inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell>{category.sortOrder}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateMutation.mutate({ id: category.id, patch: { status: category.status === "active" ? "inactive" : "active" } })}
                        >
                          {category.status === "active" ? t("disable") : t("enable")}
                        </Button>
                        <Button size="icon" variant="ghost" aria-label={t("delete")} onClick={() => deleteMutation.mutate(category.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5}>{t("empty")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
