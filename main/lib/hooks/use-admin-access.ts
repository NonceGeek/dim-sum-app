"use client";
import type { AdminAccess } from "@/lib/admin/policy";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
export function useAdminAccess() {
  const { data: session } = useSession();
  return useQuery<AdminAccess>({
    queryKey: ["business-access", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const r = await fetch("/api/admin/business-access", {
        cache: "no-store",
      });
      if (!r.ok) throw new Error("没有后台权限");
      return r.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    retry: false,
  });
}
