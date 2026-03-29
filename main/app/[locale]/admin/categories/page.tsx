"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Globe, Lock, Users, Database } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Category {
  id: number;
  name: string;
  nickname: string | null;
  description: string | null;
  is_public: boolean;
  created_at: string;
  status: string | null;
  corpusCount: number;
  permissionsCount: number;
}

interface CategoriesResponse {
  categories: Category[];
}

export default function AdminCategoriesPage() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<CategoriesResponse>({
    queryKey: ["admin-categories", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      const response = await fetch(`/api/admin/categories?${params}`);
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  const updatePublicMutation = useMutation({
    mutationFn: async ({
      name,
      is_public,
    }: {
      name: string;
      is_public: boolean;
    }) => {
      const response = await fetch("/api/admin/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, is_public }),
      });
      if (!response.ok) throw new Error("Failed to update category");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      toast.success("Category visibility updated");
    },
    onError: () => {
      toast.error("Failed to update category");
    },
  });

  const handleSearch = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          Categories
        </h2>
        <p className="text-muted-foreground mt-2">
          Manage corpus categories and visibility settings.
        </p>
      </div>

      {/* Search */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Search Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by name or nickname..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10 bg-secondary border-border text-foreground"
              />
            </div>
            <Button
              onClick={handleSearch}
              className="bg-primary hover:bg-primary/90"
            >
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Categories Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground">
                Categories List ({data?.categories.length || 0})
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Toggle visibility for each category
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {/* Skeleton table header */}
              <div className="flex gap-4 px-4 py-3 border-b border-border">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
              {/* Skeleton table rows */}
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4 items-center px-4 py-3 border-b border-border">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">Name</TableHead>
                  <TableHead className="text-muted-foreground">Nickname</TableHead>
                  <TableHead className="text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Database className="h-4 w-4" />
                      Entries
                    </div>
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      Permissions
                    </div>
                  </TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Public</TableHead>
                  <TableHead className="text-muted-foreground">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.categories.map((category) => (
                  <TableRow key={category.name} className="border-border">
                    <TableCell className="text-foreground font-medium">
                      {category.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {category.nickname || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {category.corpusCount}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {category.permissionsCount}
                    </TableCell>
                    <TableCell>
                      {category.status && (
                        <Badge
                          className={
                            category.status === "RAW"
                              ? "bg-warning text-warning-foreground"
                              : "bg-success text-success-foreground"
                          }
                        >
                          {category.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={category.is_public}
                          onCheckedChange={(checked) =>
                            updatePublicMutation.mutate({
                              name: category.name,
                              is_public: checked,
                            })
                          }
                        />
                        {category.is_public ? (
                          <Globe className="h-4 w-4 text-success" />
                        ) : (
                          <Lock className="h-4 w-4 text-warning" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(category.created_at), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
