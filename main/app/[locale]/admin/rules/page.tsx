"use client";

import { FormEvent, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

type AgentRunListResponse = {
  items: {
    id: string;
    status: string;
    ruleId?: string;
    corpusName?: string;
    taskType?: string;
    totalViolations?: number;
    recordsWithViolations?: number;
    createdAt: string;
    endedAt?: string;
  }[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
};

type AgentDescriptor = {
  id: string;
  name: string;
};

type RuleRunFormState = {
  ruleId: string;
  ruleVersion: string;
  corpusName: string;
  ruleText: string;
  agentId: string;
};

async function fetchRuns(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.append(key, String(value));
    }
  });

  const response = await fetch(`/api/admin/rules/runs?${searchParams.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch runs");
  }

  return (await response.json()) as AgentRunListResponse;
}

async function fetchAgents() {
  const response = await fetch("/api/admin/rules/agents", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch agents");
  }

  return (await response.json()) as AgentDescriptor[];
}

type FiltersState = {
  status: string;
  ruleId: string;
  corpusName: string;
  page: number;
  pageSize: number;
};

const initialFilters: FiltersState = {
  status: "",
  ruleId: "",
  corpusName: "",
  page: 1,
  pageSize: 10,
};

export default function AdminRulesPage() {
  const t = useTranslations("AdminRules");
  const locale = useLocale();
  const statusLabel = (value: string) => t(`status.${value}`);
  const statusOptions = ["all", "pending", "running", "completed", "failed", "cancelled"].map((value) => ({ value, label: t(`status.${value}`) }));
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<FiltersState>(initialFilters);
  const [compileText, setCompileText] = useState("");
  const [compileResult, setCompileResult] = useState<{ pass: boolean; failureReason?: string } | null>(null);
  const [runForm, setRunForm] = useState<RuleRunFormState>({
    ruleId: "",
    ruleVersion: "",
    corpusName: "",
    ruleText: "",
    agentId: "",
  });
  const [isCompiling, setIsCompiling] = useState(false);
  const [isTriggeringRun, setIsTriggeringRun] = useState(false);

  const { data: runsData, isLoading: runsLoading } = useQuery({
    queryKey: ["admin-rule-runs", filters],
    queryFn: () => fetchRuns(filters),
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["admin-rule-agents"],
    queryFn: fetchAgents,
  });

  const pagedRuns = useMemo(() => runsData ?? null, [runsData]);

  const handleCompile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!compileText.trim()) {
      toast.error(t("messages.enterCompile"));
      return;
    }

    setIsCompiling(true);
    setCompileResult(null);

    try {
      const response = await fetch("/api/admin/rules/compile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ruleText: compileText }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || t("messages.compileFailed"));
      }

      const result = (await response.json()) as { pass: boolean; failureReason?: string };
      setCompileResult(result);
      toast.success(result.pass ? t("messages.compilePassed") : t("messages.compileRejected"));
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : t("messages.compileFailed"));
    } finally {
      setIsCompiling(false);
    }
  };

  const handleRunSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!runForm.ruleId || !runForm.corpusName || !runForm.ruleText) {
      toast.error(t("messages.completeForm"));
      return;
    }

    setIsTriggeringRun(true);

    try {
      const response = await fetch("/api/admin/rules/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ruleId: runForm.ruleId,
          ruleVersion: runForm.ruleVersion || undefined,
          corpusName: runForm.corpusName,
          ruleText: runForm.ruleText,
          agentId: runForm.agentId || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || t("messages.runFailed"));
      }

      toast.success(t("messages.runStarted"));
      queryClient.invalidateQueries({ queryKey: ["admin-rule-runs"] });
      setRunForm({
        ruleId: "",
        ruleVersion: "",
        corpusName: "",
        ruleText: "",
        agentId: "",
      });
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : t("messages.runFailed"));
    } finally {
      setIsTriggeringRun(false);
    }
  };

  const totalPages = pagedRuns
    ? Math.ceil(pagedRuns.pagination.total / pagedRuns.pagination.pageSize)
    : 1;

  const updateFilters = (patch: Partial<FiltersState>) => {
    setFilters((prev) => ({
      ...prev,
      ...patch,
      page: patch.page !== undefined ? patch.page : 1,
    }));
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("description")}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>{t("compile.title")}</CardTitle>
            <CardDescription>{t("compile.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCompile}>
              <div className="space-y-2">
                <Label htmlFor="compile-ruleText">{t("fields.ruleText")}</Label>
                <Textarea
                  id="compile-ruleText"
                  value={compileText}
                  onChange={(event) => setCompileText(event.target.value)}
                  placeholder={t("compile.placeholder")}
                  rows={6}
                  className="bg-background border-border"
                />
              </div>
              <Button type="submit" disabled={isCompiling} className="w-full">
                {isCompiling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("compile.submit")}
              </Button>
            </form>
            {compileResult && (
              <div className="mt-4 rounded-md border border-border bg-background p-4">
                <p className="text-sm">
                  {t("compile.result")}
                  <Badge
                    variant={compileResult.pass ? "default" : "destructive"}
                    className="ml-2"
                  >
                    {compileResult.pass ? t("compile.passed") : t("compile.rejected")}
                  </Badge>
                </p>
                {!compileResult.pass && compileResult.failureReason && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {compileResult.failureReason}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>{t("run.title")}</CardTitle>
            <CardDescription>{t("run.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleRunSubmit}>
              <div className="space-y-2">
                <Label htmlFor="rule-id">{t("fields.ruleId")}</Label>
                <Input
                  id="rule-id"
                  value={runForm.ruleId}
                  onChange={(event) =>
                    setRunForm((prev) => ({ ...prev, ruleId: event.target.value }))
                  }
                  placeholder={t("run.ruleIdExample")}
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-version">{t("fields.version")}</Label>
                <Input
                  id="rule-version"
                  value={runForm.ruleVersion}
                  onChange={(event) =>
                    setRunForm((prev) => ({ ...prev, ruleVersion: event.target.value }))
                  }
                  placeholder={t("run.versionExample")}
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="corpus-name">{t("fields.corpus")}</Label>
                <Input
                  id="corpus-name"
                  value={runForm.corpusName}
                  onChange={(event) =>
                    setRunForm((prev) => ({ ...prev, corpusName: event.target.value }))
                  }
                  placeholder={t("run.corpusExample")}
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-agent">{t("fields.agent")}</Label>
                <Select
                  value={runForm.agentId || "auto"}
                  onValueChange={(value) =>
                    setRunForm((prev) => ({
                      ...prev,
                      agentId: value === "auto" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder={t("run.autoAgent")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">{t("run.auto")}</SelectItem>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-text">{t("fields.ruleText")}</Label>
                <Textarea
                  id="rule-text"
                  value={runForm.ruleText}
                  onChange={(event) =>
                    setRunForm((prev) => ({ ...prev, ruleText: event.target.value }))
                  }
                  rows={6}
                  placeholder={t("run.rulePlaceholder")}
                  className="bg-background border-border"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isTriggeringRun}>
                {isTriggeringRun && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("run.submit")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>{t("history.title")}</CardTitle>
            <CardDescription>{t("history.description")}</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-rule-runs"] })}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("history.refresh")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="filter-rule-id">{t("fields.ruleId")}</Label>
              <Input
                id="filter-rule-id"
                value={filters.ruleId}
                onChange={(event) => updateFilters({ ruleId: event.target.value })}
                placeholder={t("history.rulePlaceholder")}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-corpus-name">{t("fields.corpusShort")}</Label>
              <Input
                id="filter-corpus-name"
                value={filters.corpusName}
                onChange={(event) => updateFilters({ corpusName: event.target.value })}
                placeholder={t("history.corpusPlaceholder")}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("fields.status")}</Label>
              <Select
                value={filters.status || "all"}
                onValueChange={(value) => updateFilters({ status: value === "all" ? "" : value })}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder={t("status.all")} />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="page-size">{t("history.pageSize")}</Label>
              <Input
                id="page-size"
                type="number"
                min={1}
                value={filters.pageSize}
                onChange={(event) =>
                  updateFilters({ pageSize: Number(event.target.value) || 1 })
                }
                className="bg-background border-border"
              />
            </div>
          </div>

          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>{t("fields.ruleId")}</TableHead>
                  <TableHead>{t("fields.corpusShort")}</TableHead>
                  <TableHead>{t("fields.status")}</TableHead>
                  <TableHead>{t("history.violations")}</TableHead>
                  <TableHead>{t("history.started")}</TableHead>
                  <TableHead>{t("history.ended")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runsLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      <div className="flex items-center justify-center gap-2 py-6">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("history.loading")}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!runsLoading && pagedRuns?.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      {t("history.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {pagedRuns?.items.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-mono text-xs">{run.id}</TableCell>
                    <TableCell>{run.ruleId || "-"}</TableCell>
                    <TableCell>{run.corpusName || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{statusLabel(run.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      {run.totalViolations ?? run.recordsWithViolations ?? 0}
                    </TableCell>
                    <TableCell>
                      {new Date(run.createdAt).toLocaleString(locale)}
                    </TableCell>
                    <TableCell>
                      {run.endedAt ? new Date(run.endedAt).toLocaleString(locale) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t("history.pagination", { page: filters.page, pages: totalPages || 1, total: pagedRuns?.pagination.total ?? 0 })}
            </p>
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page <= 1}
                onClick={() => updateFilters({ page: Math.max(1, filters.page - 1) })}
              >
                {t("history.previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page >= totalPages}
                onClick={() =>
                  updateFilters({ page: Math.min(totalPages, filters.page + 1) })
                }
              >
                {t("history.next")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>{t("agents.title")}</CardTitle>
          <CardDescription>{t("agents.description")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {agents.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("agents.empty")}</p>
          )}
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="rounded-md border border-border bg-background p-4"
            >
              <p className="text-sm font-medium">{agent.name}</p>
              <p className="font-mono text-xs text-muted-foreground mt-1 break-all">
                {agent.id}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

