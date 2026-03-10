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
import { format } from "date-fns";

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
      if (!response.ok) throw new Error("Failed to fetch corpus");
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
        <h2 className="text-3xl font-bold tracking-tight text-white">
          Corpus Data
        </h2>
        <p className="text-gray-400 mt-2">
          Manage Cantonese language corpus entries and annotations.
        </p>
      </div>

      {/* Search and Filter */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Search Corpus</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search corpus data..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10 bg-gray-700 border-gray-600 text-white"
              />
            </div>
            <Input
              placeholder="Filter by category..."
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-48 bg-gray-700 border-gray-600 text-white"
            />
            <Button
              onClick={handleSearch}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Corpus Table */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">
                Corpus Entries ({data?.pagination.total || 0})
              </CardTitle>
              <CardDescription className="text-gray-400">
                View and manage corpus data entries
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-400">Loading corpus data...</div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-300">Data</TableHead>
                    <TableHead className="text-gray-300">Category</TableHead>
                    <TableHead className="text-gray-300">
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        Views
                      </div>
                    </TableHead>
                    <TableHead className="text-gray-300">
                      <div className="flex items-center gap-1">
                        <Heart className="h-4 w-4" />
                        Likes
                      </div>
                    </TableHead>
                    <TableHead className="text-gray-300">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4" />
                        Bookmarks
                      </div>
                    </TableHead>
                    <TableHead className="text-gray-300">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.corpus.map((entry) => (
                    <TableRow key={entry.uniqueId} className="border-gray-700">
                      <TableCell className="text-white max-w-md">
                        <div className="truncate" title={entry.data}>
                          {entry.data}
                        </div>
                      </TableCell>
                      <TableCell>
                        {entry.category ? (
                          <Badge className="bg-blue-500 text-white">
                            {entry.category}
                          </Badge>
                        ) : (
                          <span className="text-gray-500">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {entry.viewNum}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {entry.likedNum}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {entry.bookmarkNum}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {format(new Date(entry.createdAt), "MMM d, yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {data && data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-400">
                    Page {data.pagination.page} of{" "}
                    {data.pagination.totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="bg-gray-700 border-gray-600 text-white"
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
                      className="bg-gray-700 border-gray-600 text-white"
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
