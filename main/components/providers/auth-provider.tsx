"use client";

import { useSession } from "next-auth/react";
import { useEffect, Suspense } from "react";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { RoleTipDialog } from "@/components/dialogs/role-tip-dialog";
import { formatRole } from "@/lib/utils";

// 定义用户角色类型
export enum SessionUserRole {
  LEARNER = 'LEARNER',
  TAGGER_PARTNER = 'TAGGER_PARTNER',
  TAGGER_OUTSOURCING = 'TAGGER_OUTSOURCING',
  RESEARCHER = 'RESEARCHER',
}

/**
 * 只包含 auth 副作用逻辑，不渲染 children。
 * 单独放进 Suspense，避免整个子树（FloatingNav 等）被包进去
 * 导致 Radix UI ID 计数器服务端/客户端不一致，引发 hydration mismatch。
 */
function AuthEffects() {
  const { data: session, status } = useSession();
  const { setUser, clearUser } = useAuthStore();
  const searchParams = useSearchParams();
  const loginStatus = searchParams.get('login');
  const role = searchParams.get('role');
  const [showRoleTip, setShowRoleTip] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      setUser({
        id: session.user.id || "",
        name: session.user.name || "",
        email: session.user.email || "",
        avatar: session.user.image || "",
        role: session.user.role || "",
      });

      if (loginStatus === 'success') {
        toast.success("Sign in successful", {
          description: "Welcome back!",
        });
      }

      if (role && role !== formatRole(session.user.role as SessionUserRole).toLowerCase()) {
        setShowRoleTip(true);
      }

      const url = new URL(window.location.href);
      url.searchParams.delete('login');
      url.searchParams.delete('role');
      window.history.replaceState({}, '', url.toString());
    } else if (status === "unauthenticated") {
      clearUser();
    }
  }, [session, status, setUser, clearUser, loginStatus, role]);

  return (
    <RoleTipDialog isOpen={showRoleTip} onClose={() => setShowRoleTip(false)} />
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/*
        children 在 Suspense 外部渲染，SSR 时 ID 计数器保持一致，不产生 hydration mismatch。
        AuthEffects 单独包进 Suspense，隔离 useSearchParams() 引起的 suspension。
      */}
      <Suspense fallback={null}>
        <AuthEffects />
      </Suspense>
      {children}
    </>
  );
}
