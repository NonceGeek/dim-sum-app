"use client";

import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Plus, Copy, Check, Info } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { userApi, ApiKey } from "@/lib/api/user";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export default function ApplyPage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isLoading, error } = useQuery({
    queryKey: ["apiKeys", page],
    queryFn: () => userApi.getApiKeys({ page, limit }),
  });

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(text);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleStatusChange = (key: ApiKey) => {
    toast.info("This feature is under development", {
      description: "The ability to enable/disable API keys will be available soon.",
    });
  };

  if (isLoading) {
    return (
      <>
        <Header />
        <div className="min-h-[calc(100vh-56px)] bg-[var(--color-accent-background)]">
          <div className="container mx-auto px-4 py-8">
            <div className="max-w-5xl mx-auto">
              <Card className="p-4 sm:p-6 bg-card">
                <div className="animate-pulse space-y-4">
                  <div className="h-10 bg-muted rounded w-1/4"></div>
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-20 bg-muted rounded"></div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header />
        <div className="min-h-[calc(100vh-56px)] bg-[var(--color-accent-background)]">
          <div className="container mx-auto px-4 py-8">
            <div className="max-w-5xl mx-auto">
              <Card className="p-4 sm:p-6 bg-card">
                <div className="text-destructive text-center">
                  <p className="font-medium">Failed to load API keys</p>
                  <p className="text-sm mt-1">Please try again later</p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </>
    );
  }

  const isEmpty = !data?.data.length;

  return (
    <>
      <Header />
      <div className="min-h-[calc(100vh-56px)] bg-[var(--color-accent-background)]">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-5xl mx-auto">
            <Card className="p-4 sm:p-6 bg-card">
              <div className="flex justify-between items-center mb-6">
                <Button 
                  variant="common" 
                  size="lg" 
                  className="w-full sm:w-auto"
                  onClick={() => {
                    window.open('https://wcn3glqwz3m6.feishu.cn/share/base/form/shrcnMOPUTn1f97EpPSinEIex7d', '_blank', 'noopener,noreferrer');
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create API Key
                </Button>
              </div>

              <div className="space-y-4">
                <h2 className="text-lg font-medium">Your API keys are listed below</h2>
                
                {/* Desktop Table */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="dark:text-muted-foreground w-[40%]">API Key</TableHead>
                        <TableHead className="dark:text-muted-foreground">Created Date</TableHead>
                        <TableHead className="dark:text-muted-foreground">Status</TableHead>
                        <TableHead className="dark:text-muted-foreground">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isEmpty ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8">
                            <p className="text-muted-foreground">You haven't created any API keys yet.</p>
                            <p className="text-sm text-muted-foreground mt-1">Click the button above to create your first API key.</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.data.map((key) => (
                          <TableRow key={key.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="font-mono cursor-pointer hover:text-primary transition-colors">
                                        {key.key}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{key.key}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => copyToClipboard(key.key)}
                                >
                                  {copiedKey === key.key ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              {format(new Date(key.created_at), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  key.status === "APPROVED"
                                    ? "default"
                                    : key.status === "PENDING"
                                    ? "secondary"
                                    : "destructive"
                                }
                              >
                                {key.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {key.status === "APPROVED" ? (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="text-destructive"
                                  onClick={() => handleStatusChange(key)}
                                >
                                  Disable
                                </Button>
                              ) : (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleStatusChange(key)}
                                >
                                  Enable
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="sm:hidden space-y-4">
                  {isEmpty ? (
                    <Card className="p-4">
                      <div className="text-center py-4">
                        <p className="text-muted-foreground">You haven't created any API keys yet.</p>
                        <p className="text-sm text-muted-foreground mt-1">Click the button above to create your first API key.</p>
                      </div>
                    </Card>
                  ) : (
                    data.data.map((key) => (
                      <Card key={key.id} className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">API Key</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => copyToClipboard(key.key)}
                            >
                              {copiedKey === key.key ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="font-mono text-sm cursor-pointer hover:text-primary transition-colors block break-all">
                                  {key.key}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{key.key}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Created Date</span>
                            <span className="text-sm">
                              {format(new Date(key.created_at), "MMM d, yyyy")}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Status</span>
                            <Badge
                              variant={
                                key.status === "APPROVED"
                                  ? "default"
                                  : key.status === "PENDING"
                                  ? "secondary"
                                  : "destructive"
                              }
                            >
                              {key.status}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t">
                            <span className="text-sm text-muted-foreground">Action</span>
                            {key.status === "APPROVED" ? (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-destructive"
                                onClick={() => handleStatusChange(key)}
                              >
                                Disable
                              </Button>
                            ) : (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleStatusChange(key)}
                              >
                                Enable
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>

                {/* Pagination */}
                {data.pagination.totalPages > 1 && (
                  <div className="mt-6">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            href="#" 
                            onClick={(e) => {
                              e.preventDefault();
                              if (page > 1) setPage(page - 1);
                            }}
                            className={page === 1 ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                        {Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1).map((pageNum) => (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setPage(pageNum);
                              }}
                              isActive={pageNum === page}
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext 
                            href="#" 
                            onClick={(e) => {
                              e.preventDefault();
                              if (page < data.pagination.totalPages) setPage(page + 1);
                            }}
                            className={page === data.pagination.totalPages ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}

                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Remember to keep your API key secure and never share it publicly.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
} 