"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  Star,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

interface CorpusEntry {
  id: number;
  uniqueId: string;
  data: string;
  note: any;
  category: string | null;
  tags: any;
  editableLevel: number;
  likedNum: number;
  bookmarkNum: number;
  viewNum: number;
  createdAt: Date;
  interactionsCount: number;
}

interface CorpusResponse {
  corpus: CorpusEntry[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function AdminCorpusPage() {
  const t = useTranslations("AdminCorpus");
  const locale = useLocale();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const { data, isLoading } = useQuery<CorpusResponse>({
    queryKey: ["admin-corpus", page, search, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
      });
      if (search) params.append("search", search);
      if (categoryFilter) params.append("category", categoryFilter);

      const response = await fetch(`/api/admin/corpus?${params}`);
      if (!response.ok) throw new Error(t("errors.fetch"));
      return response.json();
    },
  });

  const handleSearch = () => {
    setPage(1);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h2>
        <p className="text-muted-foreground mt-2">
          {t("description")}
        </p>
      </div>

      {/* Search and Filter */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">{t("search.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder={t("search.placeholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10 bg-secondary border-border text-foreground"
              />
            </div>
            <Input
              placeholder={t("search.categoryPlaceholder")}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-48 bg-secondary border-border text-foreground"
            />
            <Button
              onClick={handleSearch}
              className="bg-primary hover:bg-primary/90"
            >
              {t("search.button")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Corpus Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground">
                {t("list.title", { count: data?.pagination.total || 0 })}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {t("list.description")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-muted-foreground">{t("loading")}</div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground">{t("columns.data")}</TableHead>
                    <TableHead className="text-muted-foreground">{t("columns.category")}</TableHead>
                    <TableHead className="text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        {t("columns.views")}
                      </div>
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Heart className="h-4 w-4" />
                        {t("columns.likes")}
                      </div>
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4" />
                        {t("columns.bookmarks")}
                      </div>
                    </TableHead>
                    <TableHead className="text-muted-foreground">{t("columns.created")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.corpus.map((entry) => (
                    <TableRow key={entry.uniqueId} className="border-border">
                      <TableCell className="text-foreground max-w-md">
                        <div className="truncate" title={entry.data}>
                          {entry.data}
                        </div>
                      </TableCell>
                      <TableCell>
                        {entry.category ? (
                          <Badge className="bg-info text-info-foreground">
                            {entry.category}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">{t("fallback.na")}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.viewNum}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.likedNum}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.bookmarkNum}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(entry.createdAt))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {data && data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    {t("pagination", { page: data.pagination.page, total: data.pagination.totalPages })}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="bg-secondary border-border text-foreground"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((p) =>
                          Math.min(data.pagination.totalPages, p + 1)
                        )
                      }
                      disabled={page === data.pagination.totalPages}
                      className="bg-secondary border-border text-foreground"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
