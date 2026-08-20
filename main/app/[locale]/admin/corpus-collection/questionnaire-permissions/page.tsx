"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronsUpDown, Edit3, ShieldCheck, Trash2 } from "lucide-react";
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

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
  users: Array<{ id: string; name: string | null; email: string | null; phoneNumber: string | null }>;
  activities: Array<{ id: string; title: string; status: string }>;
};

const emptyForm = {
  userId: "",
  activityId: "",
  canViewInsights: true,
  canExportInsights: false,
};

export default function QuestionnairePermissionsPage() {
  const t = useTranslations("QuestionnairePermissions");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [userPickerOpen, setUserPickerOpen] = useState(false);
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
      toast.success(t("toast.saved"));
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["questionnaire-permissions"] });
    },
    onError: () => toast.error(t("toast.saveFailed")),
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
      toast.success(t("toast.revoked"));
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["questionnaire-permissions"] });
    },
    onError: () => toast.error(t("toast.revokeFailed")),
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

  const selectedUser = data?.users.find((user) => user.id === form.userId);
  const userLabel = (user: PermissionData["users"][number]) =>
    user.name || user.email || user.phoneNumber || t("unnamedUser");
  const activityStatusLabel = (status: string) => {
    if (status === "draft") return t("activityStatus.draft");
    if (status === "published") return t("activityStatus.published");
    if (status === "offline") return t("activityStatus.offline");
    return status;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
        <p className="mt-2 text-muted-foreground">{t("description")}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>{t("form.title")}</CardTitle>
              <CardDescription className="mt-1">{t("form.description")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="operator-select">{t("form.operator")}</Label>
              <Popover open={userPickerOpen} onOpenChange={setUserPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="operator-select"
                    variant="outline"
                    role="combobox"
                    aria-expanded={userPickerOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className={cn("truncate", !selectedUser && "text-muted-foreground")}>
                      {selectedUser ? userLabel(selectedUser) : t("form.selectOperator")}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t("form.searchOperator")} />
                    <CommandList>
                      <CommandEmpty>{t("form.noOperator")}</CommandEmpty>
                      <CommandGroup>
                        {data?.users.map((user) => (
                          <CommandItem
                            key={user.id}
                            value={`${user.name ?? ""} ${user.email ?? ""} ${user.phoneNumber ?? ""} ${user.id}`}
                            onSelect={() => {
                              setForm((current) => ({ ...current, userId: user.id }));
                              setUserPickerOpen(false);
                            }}
                          >
                            <Check className={cn("h-4 w-4", form.userId === user.id ? "opacity-100" : "opacity-0")} />
                            <div className="min-w-0">
                              <div className="truncate">{userLabel(user)}</div>
                              <div className="truncate text-xs text-muted-foreground">
                                {[user.email, user.phoneNumber].filter(Boolean).join(" · ") || user.id}
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-select">{t("form.activity")}</Label>
              <Select value={form.activityId} onValueChange={(activityId) => setForm((current) => ({ ...current, activityId }))}>
                <SelectTrigger id="activity-select"><SelectValue placeholder={t("form.selectActivity")} /></SelectTrigger>
                <SelectContent>
                  {data?.activities.map((activity) => (
                    <SelectItem key={activity.id} value={activity.id}>
                      {activity.title} · {activityStatusLabel(activity.status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="view-insights">{t("form.viewInsights")}</Label>
                <p className="mt-1 text-xs text-muted-foreground">{t("form.viewInsightsDescription")}</p>
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
                <Label htmlFor="export-insights">{t("form.exportInsights")}</Label>
                <p className="mt-1 text-xs text-muted-foreground">{t("form.exportInsightsDescription")}</p>
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
              {saveMutation.isPending ? t("form.saving") : t("form.save")}
            </Button>
            <Button variant="outline" onClick={() => setForm(emptyForm)}>{t("form.clear")}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("list.title")}</CardTitle>
          <CardDescription>{t("list.description")}</CardDescription>
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
              <p className="text-sm text-muted-foreground">{t("list.loadFailed")}</p>
              <Button variant="outline" onClick={() => refetch()}>{t("list.reload")}</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("list.columns.operator")}</TableHead>
                  <TableHead>{t("list.columns.activity")}</TableHead>
                  <TableHead>{t("list.columns.view")}</TableHead>
                  <TableHead>{t("list.columns.export")}</TableHead>
                  <TableHead>{t("list.columns.updatedAt")}</TableHead>
                  <TableHead className="text-right">{t("list.columns.action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.permissions.map((permission) => (
                  <TableRow key={permission.id}>
                    <TableCell>
                      <div className="font-medium">{permission.userName || t("unnamedUser")}</div>
                      <div className="text-xs text-muted-foreground">{permission.userEmail || permission.userId}</div>
                    </TableCell>
                    <TableCell>{permission.activityTitle}</TableCell>
                    <TableCell>
                      <Badge variant={permission.canViewInsights ? "default" : "secondary"}>
                        {permission.canViewInsights ? t("list.allowed") : t("list.disabled")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={permission.canExportInsights ? "default" : "outline"}>
                        {permission.canExportInsights ? t("list.allowed") : t("list.notAllowed")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(permission.updatedAt).toLocaleString(locale)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => edit(permission)} aria-label={t("list.editLabel")}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(permission)} aria-label={t("list.revokeLabel")}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!data?.permissions.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                      {t("list.empty")}
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
            <AlertDialogTitle>{t("dialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dialog.description", { activity: deleteTarget?.activityTitle ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {t("dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
