"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Permission = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  activityId: string;
  activityTitle: string;
  canViewInsights: boolean;
  canExportInsights: boolean;
  updatedAt: string;
};

type PermissionData = {
  permissions: Permission[];
  users: Array<{ id: string; name: string | null; email: string | null }>;
  activities: Array<{ id: string; title: string; status: string }>;
};

const emptyForm = {
  userId: "",
  activityId: "",
  canViewInsights: true,
  canExportInsights: false,
};

export default function QuestionnairePermissionsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Permission | null>(null);
  const { data, isLoading, isError, refetch } = useQuery<PermissionData>({
    queryKey: ["questionnaire-permissions"],
    queryFn: async () => {
      const response = await fetch("/api/admin/corpus-collection/questionnaire-permissions");
      if (!response.ok) throw new Error("Failed to load permissions");
      return response.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/corpus-collection/questionnaire-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error("Failed to save permission");
      return response.json();
    },
    onSuccess: () => {
      toast.success("活动授权已保存");
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["questionnaire-permissions"] });
    },
    onError: () => toast.error("保存失败，请稍后重试"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (permissionId: string) => {
      const response = await fetch("/api/admin/corpus-collection/questionnaire-permissions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionId }),
      });
      if (!response.ok) throw new Error("Failed to revoke permission");
    },
    onSuccess: () => {
      toast.success("活动授权已撤销");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["questionnaire-permissions"] });
    },
    onError: () => toast.error("撤销失败，请稍后重试"),
  });

  const edit = (permission: Permission) => {
    setForm({
      userId: permission.userId,
      activityId: permission.activityId,
      canViewInsights: permission.canViewInsights,
      canExportInsights: permission.canExportInsights,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Questionnaire Permissions</h2>
        <p className="mt-2 text-muted-foreground">
          由系统管理员配置活动运营可访问的问卷洞察活动范围。
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>配置活动授权</CardTitle>
              <CardDescription className="mt-1">
                相同账号和活动重复保存时更新原授权；导出权限不会自动授予查看范围外的数据。
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="operator-select">活动运营账号</Label>
              <Select value={form.userId} onValueChange={(userId) => setForm((current) => ({ ...current, userId }))}>
                <SelectTrigger id="operator-select"><SelectValue placeholder="选择账号" /></SelectTrigger>
                <SelectContent>
                  {data?.users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.email || "未命名用户"}{user.email && user.name ? ` · ${user.email}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-select">授权活动</Label>
              <Select value={form.activityId} onValueChange={(activityId) => setForm((current) => ({ ...current, activityId }))}>
                <SelectTrigger id="activity-select"><SelectValue placeholder="选择活动" /></SelectTrigger>
                <SelectContent>
                  {data?.activities.map((activity) => (
                    <SelectItem key={activity.id} value={activity.id}>
                      {activity.title} · {activity.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="view-insights">查看问卷洞察</Label>
                <p className="mt-1 text-xs text-muted-foreground">只允许访问该活动的去标识化聚合数据。</p>
              </div>
              <Switch
                id="view-insights"
                checked={form.canViewInsights}
                onCheckedChange={(canViewInsights) =>
                  setForm((current) => ({
                    ...current,
                    canViewInsights,
                    canExportInsights: canViewInsights ? current.canExportInsights : false,
                  }))
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="export-insights">导出聚合报表</Label>
                <p className="mt-1 text-xs text-muted-foreground">导出仍执行小样本保护和专用审计。</p>
              </div>
              <Switch
                id="export-insights"
                checked={form.canExportInsights}
                disabled={!form.canViewInsights}
                onCheckedChange={(canExportInsights) =>
                  setForm((current) => ({ ...current, canExportInsights }))
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!form.userId || !form.activityId || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "保存中…" : "保存授权"}
            </Button>
            <Button variant="outline" onClick={() => setForm(emptyForm)}>清空</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>现有活动授权</CardTitle>
          <CardDescription>系统管理员拥有全部活动权限，不需要出现在此列表中。</CardDescription>
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
              <p className="text-sm text-muted-foreground">授权列表加载失败</p>
              <Button variant="outline" onClick={() => refetch()}>重新加载</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>活动运营</TableHead>
                  <TableHead>活动</TableHead>
                  <TableHead>查看洞察</TableHead>
                  <TableHead>导出</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.permissions.map((permission) => (
                  <TableRow key={permission.id}>
                    <TableCell>
                      <div className="font-medium">{permission.userName || "未命名用户"}</div>
                      <div className="text-xs text-muted-foreground">{permission.userEmail || permission.userId}</div>
                    </TableCell>
                    <TableCell>{permission.activityTitle}</TableCell>
                    <TableCell>
                      <Badge variant={permission.canViewInsights ? "default" : "secondary"}>
                        {permission.canViewInsights ? "允许" : "停用"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={permission.canExportInsights ? "default" : "outline"}>
                        {permission.canExportInsights ? "允许" : "不允许"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(permission.updatedAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => edit(permission)} aria-label="编辑授权">
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(permission)} aria-label="撤销授权">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!data?.permissions.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                      暂无活动运营授权
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>撤销该活动授权？</AlertDialogTitle>
            <AlertDialogDescription>
              撤销后，该运营账号将立即失去“{deleteTarget?.activityTitle}”的问卷洞察访问权限。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              确认撤销
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
