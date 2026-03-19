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
  User as UserIcon,
} from "lucide-react";
import { format } from "date-fns";

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
  const [operatorId, setOperatorId] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 20;

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
      if (!response.ok) throw new Error("Failed to fetch audit logs");
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
        return "Granted";
      case "REVOKE":
        return "Revoked";
      case "MODIFY":
        return "Modified";
      case "ROLE_CHANGE":
        return "Role Changed";
      default:
        return action;
    }
  };

  const formatValue = (value: any) => {
    if (!value) return "-";
    if (value.permission) return `Permission: ${value.permission}`;
    if (value.is_public !== undefined) return `Public: ${value.is_public}`;
    if (value.role) return `Role: ${value.role}`;
    return JSON.stringify(value);
  };

  const totalPages = Math.ceil((data?.total || 0) / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          Audit Logs
        </h2>
        <p className="text-muted-foreground mt-2">
          View permission change history and user activity.
        </p>
      </div>

      {/* Search and Filter */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Filter Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Operator ID..."
                value={operatorId}
                onChange={(e) => setOperatorId(e.target.value)}
                className="pl-10 bg-secondary border-border text-foreground"
              />
            </div>
            <Input
              placeholder="Target User ID..."
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              className="w-48 bg-secondary border-border text-foreground"
            />
            <Input
              placeholder="Category..."
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="w-48 bg-secondary border-border text-foreground"
            />
            <Button
              onClick={() => setOffset(0)}
              className="bg-primary hover:bg-primary/90"
            >
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">
            Audit Logs ({data?.total || 0})
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Permission and role change history
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-muted-foreground">Loading audit logs...</div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground">Time</TableHead>
                    <TableHead className="text-muted-foreground">Operator</TableHead>
                    <TableHead className="text-muted-foreground">Target User</TableHead>
                    <TableHead className="text-muted-foreground">Action</TableHead>
                    <TableHead className="text-muted-foreground">Category</TableHead>
                    <TableHead className="text-muted-foreground">Before</TableHead>
                    <TableHead className="text-muted-foreground">After</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.logs.map((log) => (
                    <TableRow key={log.id} className="border-border">
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.created_at), "MMM d, HH:mm")}
                      </TableCell>
                      <TableCell className="text-foreground">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                            <UserIcon className="w-3 h-3 text-muted-foreground" />
                          </div>
                          <span className="text-sm">
                            {log.operator.name || log.operator.email || "Admin"}
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
                              {log.target_user.name || "N/A"}
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
                      <TableCell className="text-muted-foreground text-sm">
                        {formatValue(log.old_value)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatValue(log.new_value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
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
