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

const STATUS_OPTIONS = [
  { label: "全部状态", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Running", value: "running" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
  { label: "Cancelled", value: "cancelled" },
];

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
      toast.error("请输入要编译的规则文本");
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
        throw new Error(errorData.error || "编译失败");
      }

      const result = (await response.json()) as { pass: boolean; failureReason?: string };
      setCompileResult(result);
      toast.success(result.pass ? "规则编译通过" : "规则编译未通过");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "编译失败");
    } finally {
      setIsCompiling(false);
    }
  };

  const handleRunSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!runForm.ruleId || !runForm.corpusName || !runForm.ruleText) {
      toast.error("请完整填写规则信息");
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
        throw new Error(errorData.error || "触发规则失败");
      }

      toast.success("已触发规则运行");
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
      toast.error(error instanceof Error ? error.message : "触发规则失败");
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
        <h1 className="text-3xl font-bold text-white">规则与 Agent 管理</h1>
        <p className="text-muted-foreground mt-2">
          对接 Agent 服务，支持规则编译校验、运行触发与运行历史查询。
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle>规则编译检查</CardTitle>
            <CardDescription>验证自然语言规则是否能被 Agent 理解。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCompile}>
              <div className="space-y-2">
                <Label htmlFor="compile-ruleText">规则文本</Label>
                <Textarea
                  id="compile-ruleText"
                  value={compileText}
                  onChange={(event) => setCompileText(event.target.value)}
                  placeholder="请输入要编译的规则..."
                  rows={6}
                  className="bg-gray-950 border-gray-800"
                />
              </div>
              <Button type="submit" disabled={isCompiling} className="w-full">
                {isCompiling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                开始编译
              </Button>
            </form>
            {compileResult && (
              <div className="mt-4 rounded-md border border-gray-800 bg-gray-950 p-4">
                <p className="text-sm">
                  编译结果：
                  <Badge
                    variant={compileResult.pass ? "default" : "destructive"}
                    className="ml-2"
                  >
                    {compileResult.pass ? "通过" : "未通过"}
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

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle>手动触发规则</CardTitle>
            <CardDescription>调用 `/rules/run` 接口立即创建一次运行。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleRunSubmit}>
              <div className="space-y-2">
                <Label htmlFor="rule-id">规则 ID</Label>
                <Input
                  id="rule-id"
                  value={runForm.ruleId}
                  onChange={(event) =>
                    setRunForm((prev) => ({ ...prev, ruleId: event.target.value }))
                  }
                  placeholder="例如 grammar_check_rule"
                  className="bg-gray-950 border-gray-800"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-version">规则版本 (可选)</Label>
                <Input
                  id="rule-version"
                  value={runForm.ruleVersion}
                  onChange={(event) =>
                    setRunForm((prev) => ({ ...prev, ruleVersion: event.target.value }))
                  }
                  placeholder="v1.0.0"
                  className="bg-gray-950 border-gray-800"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="corpus-name">语料库名称</Label>
                <Input
                  id="corpus-name"
                  value={runForm.corpusName}
                  onChange={(event) =>
                    setRunForm((prev) => ({ ...prev, corpusName: event.target.value }))
                  }
                  placeholder="zyzdv2"
                  className="bg-gray-950 border-gray-800"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-agent">Agent (可选)</Label>
                <Select
                  value={runForm.agentId || "auto"}
                  onValueChange={(value) =>
                    setRunForm((prev) => ({
                      ...prev,
                      agentId: value === "auto" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger className="bg-gray-950 border-gray-800">
                    <SelectValue placeholder="自动选择 Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">自动选择</SelectItem>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-text">规则文本</Label>
                <Textarea
                  id="rule-text"
                  value={runForm.ruleText}
                  onChange={(event) =>
                    setRunForm((prev) => ({ ...prev, ruleText: event.target.value }))
                  }
                  rows={6}
                  placeholder="请输入自然语言规则..."
                  className="bg-gray-950 border-gray-800"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isTriggeringRun}>
                {isTriggeringRun && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                调用 /rules/run
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>运行历史</CardTitle>
            <CardDescription>查看 Agent 返回的 run 列表。</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-rule-runs"] })}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="filter-rule-id">规则 ID</Label>
              <Input
                id="filter-rule-id"
                value={filters.ruleId}
                onChange={(event) => updateFilters({ ruleId: event.target.value })}
                placeholder="按规则 ID 筛选"
                className="bg-gray-950 border-gray-800"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-corpus-name">语料库</Label>
              <Input
                id="filter-corpus-name"
                value={filters.corpusName}
                onChange={(event) => updateFilters({ corpusName: event.target.value })}
                placeholder="按语料库筛选"
                className="bg-gray-950 border-gray-800"
              />
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <Select
                value={filters.status || "all"}
                onValueChange={(value) => updateFilters({ status: value === "all" ? "" : value })}
              >
                <SelectTrigger className="bg-gray-950 border-gray-800">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="page-size">每页数量</Label>
              <Input
                id="page-size"
                type="number"
                min={1}
                value={filters.pageSize}
                onChange={(event) =>
                  updateFilters({ pageSize: Number(event.target.value) || 1 })
                }
                className="bg-gray-950 border-gray-800"
              />
            </div>
          </div>

          <div className="rounded-md border border-gray-800">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>规则 ID</TableHead>
                  <TableHead>语料库</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>违规数</TableHead>
                  <TableHead>开始时间</TableHead>
                  <TableHead>结束时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runsLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      <div className="flex items-center justify-center gap-2 py-6">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        正在加载...
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!runsLoading && pagedRuns?.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      暂无运行记录
                    </TableCell>
                  </TableRow>
                )}
                {pagedRuns?.items.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-mono text-xs">{run.id}</TableCell>
                    <TableCell>{run.ruleId || "-"}</TableCell>
                    <TableCell>{run.corpusName || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{run.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {run.totalViolations ?? run.recordsWithViolations ?? 0}
                    </TableCell>
                    <TableCell>
                      {new Date(run.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {run.endedAt ? new Date(run.endedAt).toLocaleString() : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              第 {filters.page} / {totalPages || 1} 页，共 {pagedRuns?.pagination.total ?? 0} 条
            </p>
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page <= 1}
                onClick={() => updateFilters({ page: Math.max(1, filters.page - 1) })}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page >= totalPages}
                onClick={() =>
                  updateFilters({ page: Math.min(totalPages, filters.page + 1) })
                }
              >
                下一页
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle>可用 Agents</CardTitle>
          <CardDescription>/agents 接口返回的数据。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {agents.length === 0 && (
            <p className="text-sm text-muted-foreground">暂无 Agent</p>
          )}
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="rounded-md border border-gray-800 bg-gray-950 p-4"
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

