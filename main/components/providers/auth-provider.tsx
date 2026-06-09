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

function AuthProviderContent({ children }: { children: React.ReactNode }) {
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
    <>
      {children}
      <RoleTipDialog isOpen={showRoleTip} onClose={() => setShowRoleTip(false)} />
    </>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AuthProviderContent>{children}</AuthProviderContent>
    </Suspense>
  );
}
