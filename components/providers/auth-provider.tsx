"use client";

import { useSession } from "next-auth/react";
import { useEffect, Suspense } from "react";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

function AuthProviderContent({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const { setUser, clearUser } = useAuthStore();
  const searchParams = useSearchParams();
  const loginStatus = searchParams.get('login');

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      setUser({
        id: session.user.id || "",
        name: session.user.name || "",
        email: session.user.email || "",
        avatar: session.user.image || "",
      });

      // 使用 URL 参数判断登录成功
      if (loginStatus === 'success') {
        toast.success("Sign in successful", {
          description: "Welcome back!",
        });
        
        // 移除 URL 中的 login 参数
        const url = new URL(window.location.href);
        url.searchParams.delete('login');
        window.history.replaceState({}, '', url.toString());
      }
    } else if (status === "unauthenticated") {
      clearUser();
    }
  }, [session, status, setUser, clearUser, loginStatus]);

  return <>{children}</>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AuthProviderContent>{children}</AuthProviderContent>
    </Suspense>
  );
} 