"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<string, string> = {
  PENDING_INITIAL_REVIEW: "bg-warning/15 text-warning",
  IN_REVIEW: "bg-info/15 text-info",
  PENDING_APPLICANT_INFO: "bg-primary/10 text-primary",
  RIGHTS_PRIVACY_REVIEW: "bg-destructive/10 text-destructive",
  ACCEPTED: "bg-success/15 text-success",
  REJECTED: "bg-muted text-muted-foreground",
};

export async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error((data as { error?: string }).error || "Request failed");
  return data as T;
}

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("LibraryOps.status");
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_TONE[status],
      )}
    >
      {t(status)}
    </span>
  );
}

export function useOptionLabel() {
  const t = useTranslations("Library.contribute.options");
  return (group: string, value: string | null | undefined) =>
    value ? (t.has(`${group}.${value}`) ? t(`${group}.${value}`) : value) : "—";
}

function useUsers(
  capability: "contribution_review" | "ingestion_assignee",
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["library-ops-users", capability],
    enabled,
    queryFn: async () =>
      json<{ users: Array<{ id: string; name: string }> }>(
        await fetch(`/api/admin/library-ops/users?capability=${capability}`),
      ),
  });
}

export function UserSelect({
  id,
  capability,
  value,
  onChange,
}: {
  id: string;
  capability: "contribution_review" | "ingestion_assignee";
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("LibraryOps");
  const users = useUsers(capability, true);
  return (
    <Select
      value={value || "__empty__"}
      onValueChange={(v) => onChange(v === "__empty__" ? "" : v)}
      disabled={users.isLoading}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__empty__">
          {users.isLoading ? t("loading") : t("chooseUser")}
        </SelectItem>
        {users.data?.users.map((u) => (
          <SelectItem key={u.id} value={u.id}>
            {u.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SelectField({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  const t = useTranslations("LibraryOps");
  return (
    <Select
      value={value || "__empty__"}
      onValueChange={(v) => onChange(v === "__empty__" ? "" : v)}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__empty__">{t("choose")}</SelectItem>
        {options.map(([v, label]) => (
          <SelectItem key={v} value={v}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
