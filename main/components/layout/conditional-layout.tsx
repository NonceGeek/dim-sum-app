"use client";

import { ReactNode } from "react";

interface ConditionalLayoutProps {
  children: ReactNode;
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  return <>{children}</>;
}
