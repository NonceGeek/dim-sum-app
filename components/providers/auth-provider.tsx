"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { useAuthStore } from "@/lib/store/useAuthStore";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const { setUser, clearUser } = useAuthStore();

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      setUser({
        id: session.user.id || "",
        name: session.user.name || "",
        email: session.user.email || "",
        avatar: session.user.image || "",
      });
    } else if (status === "unauthenticated") {
      clearUser();
    }
  }, [session, status, setUser, clearUser]);

  return <>{children}</>;
} 