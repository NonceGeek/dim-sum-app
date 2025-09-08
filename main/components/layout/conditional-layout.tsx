"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MainLayout } from "./main-layout";

interface ConditionalLayoutProps {
  children: ReactNode;
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();
  
  // 检查是否是 admin 路由
  const isAdminRoute = pathname.startsWith('/admin');
  
  // 如果是 admin 路由，直接返回 children（不包装 MainLayout）
  if (isAdminRoute) {
    return <>{children}</>;
  }
  
  // 否则使用 MainLayout
  return <MainLayout>{children}</MainLayout>;
}