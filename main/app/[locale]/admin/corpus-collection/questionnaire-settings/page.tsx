"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Power, PowerOff, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type SettingsData = {
  summary: {
    total: number;
    enabled: number;
    disabled: number;
    allEnabled: boolean;
  };
  activities: Array<{
    id: string;
    title: string;
    status: string;
    activityTag: string | null;
    questionnaireGateEnabled: boolean;
  }>;
};

export default function QuestionnaireSettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery<SettingsData>({
    queryKey: ["questionnaire-settings"],
    queryFn: async () => {
      const response = await fetch("/api/admin/corpus-collection/questionnaire-settings");
      if (!response.ok) throw new Error("Failed to load settings");
      return response.json();
    },
  });
  const updateMutation = useMutation({
    mutationFn: async (input: { activityId?: string; enabled: boolean }) => {
      const response = await fetch("/api/admin/corpus-collection/questionnaire-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error("Failed to update questionnaire gate");
      return response.json();
    },
    onSuccess: (_result, input) => {
      toast.success(
        input.activityId
          ? `该活动问卷门禁已${input.enabled ? "开启" : "关闭"}`
          : `全部活动问卷门禁已${input.enabled ? "开启" : "关闭"}`,
      );
      queryClient.invalidateQueries({ queryKey: ["questionnaire-settings"] });
    },
    onError: () => toast.error("门禁设置更新失败"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Questionnaire Settings</h2>
          <p className="mt-2 text-muted-foreground">
            配置活动投稿是否强制完成参赛前问卷。现有活动和新活动默认全部开启。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => updateMutation.mutate({ enabled: true })}
            disabled={updateMutation.isPending || data?.summary.allEnabled}
          >
            <Power className="mr-2 h-4 w-4" />
            全部开启
          </Button>
          <Button
            variant="outline"
            onClick={() => updateMutation.mutate({ enabled: false })}
            disabled={updateMutation.isPending || data?.summary.enabled === 0}
          >
            <PowerOff className="mr-2 h-4 w-4" />
            全部关闭
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "活动总数", value: data?.summary.total ?? 0, icon: Settings2 },
          { label: "门禁已开启", value: data?.summary.enabled ?? 0, icon: ClipboardCheck },
          { label: "门禁已关闭", value: data?.summary.disabled ?? 0, icon: PowerOff },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-center justify-between pt-6">
              <div>
                <p className="text-sm text-muted-foreground">{item.label}</p>
                {isLoading ? <Skeleton className="mt-2 h-9 w-16" /> : <p className="mt-2 text-3xl font-bold">{item.value}</p>}
              </div>
              <div className="rounded-lg bg-primary/10 p-2.5 text-primary"><item.icon className="h-5 w-5" /></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>按活动配置</CardTitle>
          <CardDescription>
            关闭后，该活动投稿暂时兼容旧流程；普通非活动投稿始终不受问卷门禁影响。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <p className="text-sm text-muted-foreground">门禁配置加载失败</p>
              <Button variant="outline" onClick={() => refetch()}>重新加载</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>活动</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>活动标签</TableHead>
                  <TableHead className="text-right">强制问卷门禁</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.activities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell className="font-medium">{activity.title}</TableCell>
                    <TableCell><Badge variant="secondary">{activity.status}</Badge></TableCell>
                    <TableCell>
                      {activity.activityTag ? <Badge variant="outline">{activity.activityTag}</Badge> : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-3">
                        <span className="text-sm text-muted-foreground">
                          {activity.questionnaireGateEnabled ? "已开启" : "已关闭"}
                        </span>
                        <Switch
                          checked={activity.questionnaireGateEnabled}
                          disabled={updateMutation.isPending}
                          onCheckedChange={(enabled) =>
                            updateMutation.mutate({ activityId: activity.id, enabled })
                          }
                          aria-label={`${activity.title}问卷门禁`}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!data?.activities.length && (
                  <TableRow><TableCell colSpan={4} className="h-28 text-center text-muted-foreground">暂无活动</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
