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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  User as UserIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

interface AuditLog {
  id: number;
  operator_id: string;
  target_user_id: string;
  category_name: string | null;
  action: string;
  old_value: any;
  new_value: any;
  created_at: string;
  operator: {
    id: string;
    name: string | null;
    email: string | null;
  };
  target_user: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
  };
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

export default function AdminAuditLogsPage() {
  const t = useTranslations("AdminAuditLogs");
  const locale = useLocale();
  const [operatorId, setOperatorId] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [offset, setOffset] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const limit = 20;

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const { data, isLoading } = useQuery<AuditLogsResponse>({
    queryKey: [
      "admin-audit-logs",
      operatorId,
      targetUserId,
      categoryName,
      offset,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });
      if (operatorId) params.append("operator_id", operatorId);
      if (targetUserId) params.append("target_user_id", targetUserId);
      if (categoryName) params.append("category_name", categoryName);

      const response = await fetch(`/api/admin/audit-logs?${params}`);
      if (!response.ok) throw new Error(t("errors.fetch"));
      return response.json();
    },
  });

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case "GRANT":
        return "bg-success text-success-foreground";
      case "REVOKE":
        return "bg-error text-error-foreground";
      case "MODIFY":
        return "bg-info text-info-foreground";
      case "ROLE_CHANGE":
        return "bg-primary text-primary-foreground";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "GRANT":
        return t("actions.granted");
      case "REVOKE":
        return t("actions.revoked");
      case "MODIFY":
        return t("actions.modified");
      case "ROLE_CHANGE":
        return t("actions.roleChanged");
      default:
        return action;
    }
  };

  const formatValue = (value: any) => {
    if (!value) return "-";
    if (value.permission) return t("values.permission", { value: value.permission });
    if (value.is_public !== undefined) return t("values.public", { value: String(value.is_public) });
    if (value.role) return t("values.role", { value: value.role });
    return JSON.stringify(value);
  };

  const totalPages = Math.ceil((data?.total || 0) / limit);
  const currentPage = Math.floor(offset / limit) + 1;

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
          <CardTitle className="text-foreground">{t("filter.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder={t("filter.operator")}
                value={operatorId}
                onChange={(e) => setOperatorId(e.target.value)}
                className="pl-10 bg-secondary border-border text-foreground"
              />
            </div>
            <Input
              placeholder={t("filter.targetUser")}
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              className="w-48 bg-secondary border-border text-foreground"
            />
            <Input
              placeholder={t("filter.category")}
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="w-48 bg-secondary border-border text-foreground"
            />
            <Button
              onClick={() => setOffset(0)}
              className="bg-primary hover:bg-primary/90"
            >
              {t("filter.search")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">
            {t("list.title", { count: data?.total || 0 })}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {t("list.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {/* Skeleton table header */}
              <div className="flex gap-4 px-4 py-3 border-b border-border">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
              </div>
              {/* Skeleton table rows */}
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex gap-4 items-center px-4 py-3 border-b border-border">
                  <Skeleton className="h-4 w-24" />
                  <div className="flex items-center gap-2 w-32">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <div className="flex items-center gap-2 w-32">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground w-8"></TableHead>
                    <TableHead className="text-muted-foreground">{t("columns.time")}</TableHead>
                    <TableHead className="text-muted-foreground">{t("columns.operator")}</TableHead>
                    <TableHead className="text-muted-foreground">{t("columns.targetUser")}</TableHead>
                    <TableHead className="text-muted-foreground">{t("columns.action")}</TableHead>
                    <TableHead className="text-muted-foreground">{t("columns.category")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.logs.map((log) => (
                    <>
                      <TableRow
                        key={log.id}
                        className="border-border cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleRow(log.id)}
                      >
                        <TableCell className="w-8 px-2">
                          <ChevronDown
                            className={`h-4 w-4 text-muted-foreground transition-transform ${
                              expandedRows.has(log.id) ? "rotate-0" : "-rotate-90"
                            }`}
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(log.created_at))}
                        </TableCell>
                        <TableCell className="text-foreground">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                              <UserIcon className="w-3 h-3 text-muted-foreground" />
                            </div>
                            <span className="text-sm">
                              {log.operator.name || log.operator.email || t("fallback.admin")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-foreground">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                              <UserIcon className="w-3 h-3 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="text-sm">
                                {log.target_user.name || t("fallback.na")}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {log.target_user.role}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getActionBadgeColor(log.action)}>
                            {getActionLabel(log.action)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {log.category_name || "-"}
                        </TableCell>
                      </TableRow>
                      {expandedRows.has(log.id) && (
                        <TableRow key={`${log.id}-detail`} className="border-border bg-muted/30">
                          <TableCell colSpan={6} className="py-3 px-6">
                            <div className="flex gap-8 text-sm">
                              <div>
                                <span className="text-muted-foreground font-medium">{t("details.before")}</span>
                                <span className="text-foreground">{formatValue(log.old_value)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground font-medium">{t("details.after")}</span>
                                <span className="text-foreground">{formatValue(log.new_value)}</span>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    {t("pagination", { page: currentPage, total: totalPages })}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOffset(Math.max(0, offset - limit))}
                      disabled={offset === 0}
                      className="bg-secondary border-border text-foreground"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOffset(offset + limit)}
                      disabled={currentPage >= totalPages}
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
