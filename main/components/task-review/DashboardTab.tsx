"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTaskStats } from "@/lib/hooks/useTaskReview";
import { StatsCard, getRateColor, formatPercent } from "./StatsCard";
import { UserTasksDialog } from "./UserTasksDialog";
import type { TaskStatsItemWithUser } from "@/lib/types/task-review";

interface DashboardTabProps {
  datasets?: { label: string; value: string }[];
}

/** Aggregate per-user stats across all corpora for a single user. */
interface AggregatedUserStats {
  assigneeRef: string;
  name: string | null;
  avatar: string | null;
  totalCount: number;
  processedCount: number;
  unprocessedCount: number;
  completionRate: number;
}

function aggregateByUser(items: TaskStatsItemWithUser[]): AggregatedUserStats[] {
  const map = new Map<string, AggregatedUserStats>();

  for (const item of items) {
    const existing = map.get(item.assigneeRef);
    if (existing) {
      existing.totalCount += item.totalCount;
      existing.processedCount += item.processedCount;
      existing.unprocessedCount += item.unprocessedCount;
    } else {
      map.set(item.assigneeRef, {
        assigneeRef: item.assigneeRef,
        name: item.name,
        avatar: item.avatar,
        totalCount: item.totalCount,
        processedCount: item.processedCount,
        unprocessedCount: item.unprocessedCount,
        completionRate: 0,
      });
    }
  }

  // Compute completion rate
  for (const user of map.values()) {
    user.completionRate =
      user.totalCount > 0 ? user.processedCount / user.totalCount : 0;
  }

  return Array.from(map.values()).sort(
    (a, b) => b.completionRate - a.completionRate
  );
}

export function DashboardTab({ datasets }: DashboardTabProps) {
  const t = useTranslations("TaskReview");
  const [corpusName, setCorpusName] = useState<string>(
    datasets?.[0]?.value || ""
  );
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { data: stats, isLoading } = useTaskStats(
    corpusName ? { corpusName } : null
  );

  // Aggregate per-user items from backend
  const userRows = useMemo(
    () => aggregateByUser(stats?.items ?? []),
    [stats?.items]
  );

  const filteredRows = userSearch
    ? userRows.filter((r) =>
        r.name?.toLowerCase().includes(userSearch.toLowerCase())
      )
    : userRows;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {datasets && datasets.length > 0 && (
          <Select value={corpusName} onValueChange={setCorpusName}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t("allDatasets")} />
            </SelectTrigger>
            <SelectContent>
              {datasets.map((ds) => (
                <SelectItem key={ds.value} value={ds.value}>
                  {ds.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {!datasets?.length && (
          <Input
            value={corpusName}
            onChange={(e) => setCorpusName(e.target.value)}
            placeholder={t("dataset")}
            className="w-[200px]"
          />
        )}

        <div className="flex items-center gap-2 border rounded-md px-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder={t("searchUser")}
            className="border-0 w-[160px] focus-visible:ring-0"
          />
        </div>
      </div>

      {/* Summary Stats */}
      {isLoading ? (
        <Skeleton className="h-28 w-full rounded-lg" />
      ) : stats ? (
        <StatsCard
          totalCorpusCount={stats.summary.totalCorpusCount}
          totalCount={stats.summary.totalCount}
          processedCount={stats.summary.processedCount}
          unprocessedCount={stats.summary.unprocessedCount}
          completionRate={stats.summary.completionRate}
        />
      ) : corpusName ? (
        <Card className="p-8 text-center text-muted-foreground">
          {t("noTasks")}
        </Card>
      ) : null}

      {/* Per-User Table */}
      {!isLoading && filteredRows.length > 0 && (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("user")}</TableHead>
                <TableHead className="text-center">{t("totalTaskCount")}</TableHead>
                <TableHead className="text-center">{t("processedCount")}</TableHead>
                <TableHead className="text-center">{t("unprocessedCount")}</TableHead>
                <TableHead className="text-center">{t("completionRate")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.assigneeRef}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {row.avatar ? (
                        <img
                          src={row.avatar}
                          alt=""
                          className="w-6 h-6 rounded-full"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
                          {(row.name || "?")[0]}
                        </div>
                      )}
                      <span className="text-sm">{row.name || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {row.totalCount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {row.processedCount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {row.unprocessedCount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={getRateColor(row.completionRate)}>
                      {formatPercent(row.completionRate)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setSelectedUser({
                          id: row.assigneeRef,
                          name: row.name || "—",
                        })
                      }
                    >
                      {t("viewUserTasks")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* User Tasks Dialog */}
      {selectedUser && (
        <UserTasksDialog
          open={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          userId={selectedUser.id}
          userName={selectedUser.name}
          corpusName={corpusName}
        />
      )}
    </div>
  );
}
