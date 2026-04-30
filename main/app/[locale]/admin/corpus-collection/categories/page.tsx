"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
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

export default function CorpusCollectionCategoriesPage() {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState("all");
  const [form, setForm] = useState({ name: "", type: "tag", sortOrder: "0" });

  const { data, isLoading } = useQuery<{ items: Category[] }>({
    queryKey: ["corpus-collection-categories", filterType],
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
        body: JSON.stringify({ ...form, sortOrder: Number(form.sortOrder) }),
      });
      if (!response.ok) throw new Error("Failed to create category");
      return response.json();
    },
    onSuccess: () => {
      toast.success("Category created");
      setForm({ name: "", type: "tag", sortOrder: "0" });
      queryClient.invalidateQueries({ queryKey: ["corpus-collection-categories"] });
    },
    onError: () => toast.error("Failed to create category"),
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
      toast.success("Category updated");
      queryClient.invalidateQueries({ queryKey: ["corpus-collection-categories"] });
    },
    onError: () => toast.error("Failed to update category"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/corpus-collection/categories/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete category");
      return response.json();
    },
    onSuccess: () => {
      toast.success("Category deleted");
      queryClient.invalidateQueries({ queryKey: ["corpus-collection-categories"] });
    },
    onError: () => toast.error("Failed to delete category"),
  });

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Categories</h2>
        <p className="text-muted-foreground mt-2">Configure submission types and public tags.</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Add Category</CardTitle>
          <CardDescription>Tags configured here are shown in submission forms.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-[1fr_180px_120px_auto]" onSubmit={handleCreate}>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(type) => setForm({ ...form, type })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="submission_type">Submission Type</SelectItem>
                  <SelectItem value="tag">Tag</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sort</Label>
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Category List</CardTitle>
              <CardDescription>Enable, disable, or remove categories.</CardDescription>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="submission_type">Submission Type</SelectItem>
                <SelectItem value="tag">Tag</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sort</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5}>Loading...</TableCell></TableRow>
              ) : data?.items.length ? (
                data.items.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell>{category.type}</TableCell>
                    <TableCell>
                      <Badge className={category.status === "active" ? "bg-success text-success-foreground" : "bg-secondary text-secondary-foreground"}>
                        {category.status}
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
                          {category.status === "active" ? "Disable" : "Enable"}
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(category.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5}>No categories found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
