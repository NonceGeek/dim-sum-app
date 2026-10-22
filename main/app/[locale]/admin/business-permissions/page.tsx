"use client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  COLLECTION_ACTIONS,
  ROLE_PRESETS,
  type CollectionRole,
} from "@/lib/collection-permissions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
const actionLabels: Record<string, [string, string]> = {
  view: ["查看", "View"],
  approve: ["通过", "Approve"],
  reject: ["拒绝", "Reject"],
  review_needed: ["转人工审核", "Flag for review"],
  feature: ["精选", "Feature"],
  home: ["首页展示", "Home display"],
  ai_review: ["AI 审核", "AI review"],
  award: ["获奖标记", "Award"],
  visibility: ["可见性", "Visibility"],
};
const roleLabels = {
  DATASET_ADMIN: "语料管理员",
  ACTIVITY_ADMIN: "活动管理员",
};
async function json(r: Response) {
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "请求失败");
  return data;
}
export default function BusinessPermissionsPage() {
  const locale = useLocale();
  const en = locale === "en";
  const t = (zh: string, english: string) => (en ? english : zh);
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [userId, setUserId] = useState("");
  const [scopeType, setScopeType] = useState("dataset");
  const [scopeId, setScopeId] = useState("");
  const [role, setRole] = useState("OPERATOR");
  const [actions, setActions] = useState<string[]>([
    ...ROLE_PRESETS.ACTIVITY_REVIEWER,
  ]);
  const [note, setNote] = useState("");
  const q = useQuery({
    queryKey: ["business-permissions", userId],
    queryFn: () =>
      fetch(
        `/api/admin/business-permissions${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`,
      ).then(json),
  });
  const users = useQuery({
    queryKey: ["business-user-search", submitted],
    enabled: submitted.length >= 2,
    queryFn: () =>
      fetch(
        `/api/admin/business-permissions?q=${encodeURIComponent(submitted)}`,
      ).then(json),
  });
  const save = useMutation({
    mutationFn: (body: object) =>
      fetch("/api/admin/business-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, userId, note }),
      }).then(json),
    onSuccess: () => {
      toast.success(t("授权已更新", "Permissions updated"));
      client.invalidateQueries({ queryKey: ["business-permissions"] });
      client.invalidateQueries({ queryKey: ["business-access"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const objects =
    scopeType === "dataset" ? q.data?.datasets : q.data?.activities;
  return (
    <div className="space-y-5 max-w-5xl">
      <h2 className="text-2xl font-bold">
        {t("业务范围权限", "Business permissions")}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t(
          "平台角色仅超管可改。业务角色赋予创建资格；管理与运营另按语料集或活动授权。语料管理员同时负责贡献审核及入库待办承接。",
          "Platform roles are managed by super admins. Business roles enable creation; object access is granted separately. Dataset admins also review contributions and accept ingestion leads.",
        )}
      </p>
      <Label htmlFor="permission-user-search">
        {t("UID、姓名、邮箱或手机号", "UID, name, email or phone")}
      </Label>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(search.trim());
        }}
      >
        <Input
          id="permission-user-search"
          aria-label={t("UID、姓名、邮箱或手机号", "UID, name, email or phone")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          minLength={2}
        />
        <Button>{t("搜索用户", "Search users")}</Button>
      </form>
      {users.error && <p role="alert">{users.error.message}</p>}
      <div className="flex flex-wrap gap-2">
        {users.data?.users?.map((u: any) => (
          <Button
            key={u.id}
            className="h-auto max-w-full whitespace-normal break-all text-left"
            variant={userId === u.id ? "default" : "outline"}
            onClick={() => setUserId(u.id)}
          >
            {u.name || u.id} · {u.id}
          </Button>
        ))}
      </div>
      {q.error && <p role="alert">{q.error.message}</p>}
      {userId && q.data && (
        <>
          <p className="break-all font-mono text-sm text-muted-foreground">
            UID: {userId}
          </p>
          {q.data.isPlatformAdmin && (
            <Card>
              <CardHeader>
                <h3 className="font-semibold">
                  {t(
                    "业务管理员角色（创建资格）",
                    "Business admin roles (creation)",
                  )}
                </h3>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(roleLabels).map(([r, label]) => {
                  const active = q.data.roles.some(
                    (x: any) => x.role === r && x.active,
                  );
                  return (
                    <div
                      key={r}
                      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span>
                        {t(
                          label,
                          r === "DATASET_ADMIN"
                            ? "Dataset admin"
                            : "Activity admin",
                        )}
                      </span>
                      <Button
                        disabled={save.isPending}
                        variant={active ? "destructive" : "outline"}
                        onClick={() =>
                          save.mutate({
                            kind: "business",
                            role: r,
                            active: !active,
                          })
                        }
                      >
                        {active
                          ? t(
                              "撤销角色及其管理员范围",
                              "Revoke role and admin scopes",
                            )
                          : t("授予角色", "Grant role")}
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <h3 className="font-semibold">{t("对象授权", "Object grant")}</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="scope-type">
                    {t("对象类型", "Scope type")}
                  </Label>
                  <Select
                    value={scopeType}
                    onValueChange={(value) => {
                      setScopeType(value);
                      setScopeId("");
                    }}
                  >
                    <SelectTrigger
                      id="scope-type"
                      className="w-full"
                      aria-label={t("对象类型", "Scope type")}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dataset">
                        {t("语料集", "Dataset")}
                      </SelectItem>
                      <SelectItem value="activity">
                        {t("活动", "Activity")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="scope-object">{t("对象", "Object")}</Label>
                  <Select value={scopeId} onValueChange={setScopeId}>
                    <SelectTrigger
                      id="scope-object"
                      className="w-full min-w-0 [&_[data-slot=select-value]]:truncate"
                      aria-label={t("对象", "Object")}
                    >
                      <SelectValue
                        placeholder={t("请选择对象", "Select object")}
                      />
                    </SelectTrigger>
                    <SelectContent className="max-w-[calc(100vw-2rem)]">
                      {objects?.map((o: any) => (
                        <SelectItem key={o.id} value={String(o.id)}>
                          #{o.id} {o.nickname || o.name || o.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="scope-role">
                    {t("对象角色", "Object role")}
                  </Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger
                      id="scope-role"
                      className="w-full"
                      aria-label={t("对象角色", "Object role")}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPERATOR">
                        {t("运营", "Operator")}
                      </SelectItem>
                      {q.data.isPlatformAdmin && (
                        <SelectItem value="ADMIN">
                          {t(
                            "管理员（先授对应业务角色）",
                            "Admin (business role required)",
                          )}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {scopeType === "activity" && role === "OPERATOR" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="activity-preset">
                      {t("活动动作预设", "Activity preset")}
                    </Label>
                    <Select
                      value={
                        Object.keys(ROLE_PRESETS).find((r) => {
                          const preset = ROLE_PRESETS[r as CollectionRole];
                          return (
                            preset.length === actions.length &&
                            preset.every((a) => actions.includes(a))
                          );
                        }) ?? "custom"
                      }
                      onValueChange={(value) =>
                        setActions([...ROLE_PRESETS[value as CollectionRole]])
                      }
                    >
                      <SelectTrigger
                        id="activity-preset"
                        className="w-full md:w-72"
                        aria-label={t("活动动作预设", "Activity preset")}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom" disabled>
                          {t("自定义动作", "Custom actions")}
                        </SelectItem>
                        {Object.keys(ROLE_PRESETS).map((r) => (
                          <SelectItem key={r} value={r}>
                            {r === "ACTIVITY_REVIEWER"
                              ? t("投稿审核", "Submission review")
                              : r === "ACTIVITY_OPERATOR"
                                ? t("内容运营", "Content operations")
                                : t("全部投稿动作", "All submission actions")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <fieldset className="space-y-3">
                    <legend className="text-sm font-medium">
                      {t("允许的动作", "Allowed actions")}
                    </legend>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {COLLECTION_ACTIONS.map((a) => (
                        <div key={a} className="flex items-center gap-2">
                          <Checkbox
                            id={`action-${a}`}
                            checked={actions.includes(a)}
                            onCheckedChange={(checked) =>
                              setActions(
                                checked === true
                                  ? [...actions, a]
                                  : actions.filter((x) => x !== a),
                              )
                            }
                          />
                          <Label htmlFor={`action-${a}`}>
                            {t(...actionLabels[a])}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </fieldset>
                </>
              )}
              {scopeType === "dataset" && (
                <p className="text-sm">
                  {t(
                    "语料运营统一有/无，不设置细分动作；不能管理或删除语料集。",
                    "Dataset operations are one on/off grant; operators cannot manage or delete datasets.",
                  )}
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="grant-note">
                  {t("授权备注", "Grant note")}
                </Label>
                <Input
                  id="grant-note"
                  aria-label={t("授权备注", "Grant note")}
                  placeholder={t(
                    "授权或撤销原因",
                    "Reason for granting or revoking",
                  )}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={1000}
                />
              </div>
              <Button
                disabled={!scopeId || save.isPending}
                onClick={() =>
                  save.mutate({
                    kind: "scope",
                    scopeType,
                    scopeId,
                    role,
                    active: true,
                    actions:
                      scopeType === "activity" && role === "OPERATOR"
                        ? actions
                        : [],
                  })
                }
              >
                {t("保存对象授权", "Save grant")}
              </Button>
            </CardContent>
          </Card>
          <section className="space-y-2">
            <h3 className="font-semibold">
              {t("当前有效范围", "Active scopes")}
            </h3>
            {q.data.grants.map((g: any) => (
              <div
                key={g.scope_type + g.scope_id}
                className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span>
                  {g.scope_type === "dataset"
                    ? t("语料集", "Dataset")
                    : t("活动", "Activity")}{" "}
                  #{g.scope_id} ·{" "}
                  {g.role === "ADMIN"
                    ? t("管理员", "Admin")
                    : t("运营", "Operator")}{" "}
                  {g.actions
                    .map((a: string) => t(...actionLabels[a]))
                    .join(", ")}
                </span>
                {(q.data.isPlatformAdmin || g.role !== "ADMIN") && (
                  <Button
                    variant="destructive"
                    disabled={save.isPending}
                    onClick={() =>
                      save.mutate({
                        kind: "scope",
                        scopeType: g.scope_type,
                        scopeId: g.scope_id,
                        role: g.role,
                        actions: [],
                        active: false,
                      })
                    }
                  >
                    {t("撤销", "Revoke")}
                  </Button>
                )}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
