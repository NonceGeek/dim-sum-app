"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { savePermissionChanges } from "@/lib/admin/permission-ui-save";
import { BusinessPermissionsWorkspace } from "@/components/admin/business-permissions-workspace";
import {
  singleSearchUser,
  type PermissionUser,
  type PermissionData,
  type PermissionChange,
  type SaveResult,
} from "@/lib/admin/permission-ui";

async function json(response: Response) {
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.error === "string" ? data.error : "请求失败 / Request failed",
    );
  return data;
}

export default function BusinessPermissionsPage() {
  const en = useLocale() === "en";
  const t = (zh: string, english: string) => (en ? english : zh);
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const users = useQuery<{ users: PermissionUser[]; hasMore: boolean }>({
    queryKey: ["business-user-search", submitted],
    enabled: submitted.length >= 2,
    queryFn: () =>
      fetch(
        `/api/admin/business-permissions?q=${encodeURIComponent(submitted)}`,
        { cache: "no-store" },
      ).then(json),
  });
  const q = useQuery<PermissionData>({
    queryKey: ["business-permissions", userId],
    queryFn: () =>
      fetch(
        `/api/admin/business-permissions${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`,
        { cache: "no-store" },
      ).then(json),
  });
  // Wait for this query to finish; a truncated result page is not a unique match.
  useEffect(() => {
    if (!submitted || users.isFetching || users.isError || userId || busy)
      return;
    const only = singleSearchUser(users.data);
    if (only) setUserId(only.id);
  }, [submitted, users.data, users.isFetching, users.isError, userId, busy]);
  const selected =
    q.data?.target?.id === userId
      ? q.data.target
      : users.data?.users.find((user) => user.id === userId);

  async function save(
    changes: PermissionChange[],
    note: string,
  ): Promise<SaveResult[]> {
    // Capture the recipient before asynchronous requests. Never reuse a later user selection.
    const targetId = userId;
    setBusy(true);
    try {
      const result = await savePermissionChanges(targetId, changes, note);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["business-permissions"] }),
        client.invalidateQueries({ queryKey: ["business-access"] }),
      ]);
      return result;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h2 className="text-2xl font-bold">
          {t("业务权限管理", "Business permissions")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "先查找用户，查看已有权限，再设置管理员或运营权限。",
            "Find a user, review their access, then manage admin or operator permissions.",
          )}
        </p>
      </div>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          const next = search.trim();
          if (next.length < 2 || busy) return;
          setUserId("");
          if (next === submitted) void users.refetch();
          setSubmitted(next);
        }}
      >
        <Label htmlFor="permission-user-search">
          {t("UID、姓名、邮箱或手机号", "UID, name, email or phone")}
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="permission-user-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            minLength={2}
            maxLength={100}
            disabled={busy}
            required
            autoComplete="off"
          />
          <Button
            disabled={busy || search.trim().length < 2 || users.isFetching}
          >
            {users.isFetching
              ? t("正在搜索…", "Searching…")
              : t("搜索用户", "Search users")}
          </Button>
        </div>
      </form>
      {users.error && (
        <p role="alert" className="text-sm text-destructive">
          {users.error.message}
        </p>
      )}
      {submitted && !users.isFetching && users.data?.users.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t(
            "未找到用户，请换一个关键词。",
            "No users found. Try a different query.",
          )}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {!users.isFetching &&
          users.data?.users.map((user) => (
            <Button
              key={user.id}
              disabled={busy}
              aria-pressed={userId === user.id}
              variant={userId === user.id ? "default" : "outline"}
              className="h-auto max-w-full flex-col items-start gap-1 whitespace-normal break-all text-left"
              onClick={() => setUserId(user.id)}
            >
              <span>
                {user.name || user.id}
                {(user.emailHint || user.phoneHint) &&
                  ` · ${user.emailHint || user.phoneHint}`}
              </span>
              <span className="font-mono text-xs opacity-80">
                UID: {user.id}
              </span>
            </Button>
          ))}
      </div>
      {users.data?.hasMore && !users.isFetching && (
        <p className="text-sm text-muted-foreground">
          {t(
            "结果较多，请输入更完整的姓名、邮箱或 UID 缩小范围。",
            "More matches exist. Enter a more specific name, email or UID.",
          )}
        </p>
      )}
      {q.error && (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>
            {t(
              "无法读取最新权限，暂时停止权限配置。",
              "Unable to refresh permissions. Editing is paused.",
            )}{" "}
            {q.error.message}
          </p>
          <Button
            variant="outline"
            disabled={busy || q.isFetching}
            onClick={() => void q.refetch()}
          >
            {t("重新加载权限", "Reload permissions")}
          </Button>
        </div>
      )}
      {userId && q.isPending && (
        <p role="status">
          {t("正在读取用户权限…", "Loading user permissions…")}
        </p>
      )}
      {userId && selected && q.data && (
        <BusinessPermissionsWorkspace
          key={userId}
          data={q.data}
          user={selected}
          busy={busy || q.isError}
          onSave={save}
        />
      )}
    </div>
  );
}
