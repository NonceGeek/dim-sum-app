"use client";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLocale } from "next-intl";
import { useState } from "react";
import { appCopy } from "./copy";
import type { StoreApp } from "@/lib/app-store/model";
export type SavedApp = { id: string; savedAt: string; app: StoreApp | null };
export async function appJson<T>(r: Response): Promise<T> {
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? "Request failed");
  return data;
}
export function useAppFavorites() {
  const session = useSession();
  const client = useQueryClient();
  const t = appCopy(useLocale());
  const [pending, setPending] = useState<string | null>(null);
  const user = session.data?.user?.id;
  const key = ["app-favorites", user];
  const query = useQuery({
    queryKey: key,
    enabled: session.status === "authenticated",
    retry: false,
    queryFn: () =>
      fetch("/api/user/app-favorites", { cache: "no-store" }).then(
        appJson<{ favorites: SavedApp[] }>,
      ),
  });
  const saved = new Set(query.data?.favorites.map((v) => v.id) ?? []);
  async function toggle(id: string, remove = false) {
    if (session.status !== "authenticated") return false;
    if (pending) return true;
    setPending(id);
    try {
      const next = remove ? false : !saved.has(id);
      await appJson(
        await fetch("/api/user/app-favorites", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appId: id, saved: next }),
        }),
      );
      await client.invalidateQueries({ queryKey: key });
      toast.success(next ? t.saved : t.removed);
      return true;
    } catch {
      toast.error(t.favoriteFailed);
      return true;
    } finally {
      setPending(null);
    }
  }
  return {
    query,
    saved,
    toggle,
    pending,
    authenticated: session.status === "authenticated",
    loadingSession: session.status === "loading",
  };
}
