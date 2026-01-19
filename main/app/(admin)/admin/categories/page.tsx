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
        <h2 className="text-3xl font-bold tracking-tight text-white">
          Categories
        </h2>
        <p className="text-gray-400 mt-2">
          Manage corpus categories and visibility settings.
        </p>
      </div>

      {/* Search */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Search Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by name or nickname..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10 bg-gray-700 border-gray-600 text-white"
              />
            </div>
            <Button
              onClick={handleSearch}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Categories Table */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">
                Categories List ({data?.categories.length || 0})
              </CardTitle>
              <CardDescription className="text-gray-400">
                Toggle visibility for each category
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-400">Loading categories...</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700">
                  <TableHead className="text-gray-300">Name</TableHead>
                  <TableHead className="text-gray-300">Nickname</TableHead>
                  <TableHead className="text-gray-300">
                    <div className="flex items-center gap-1">
                      <Database className="h-4 w-4" />
                      Entries
                    </div>
                  </TableHead>
                  <TableHead className="text-gray-300">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      Permissions
                    </div>
                  </TableHead>
                  <TableHead className="text-gray-300">Status</TableHead>
                  <TableHead className="text-gray-300">Public</TableHead>
                  <TableHead className="text-gray-300">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.categories.map((category) => (
                  <TableRow key={category.name} className="border-gray-700">
                    <TableCell className="text-white font-medium">
                      {category.name}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {category.nickname || "-"}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {category.corpusCount}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {category.permissionsCount}
                    </TableCell>
                    <TableCell>
                      {category.status && (
                        <Badge
                          className={
                            category.status === "RAW"
                              ? "bg-yellow-500"
                              : "bg-green-500"
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
                          <Globe className="h-4 w-4 text-green-400" />
                        ) : (
                          <Lock className="h-4 w-4 text-yellow-400" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-300">
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
