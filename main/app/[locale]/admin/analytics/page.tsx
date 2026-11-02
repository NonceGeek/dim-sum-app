"use client";

import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";
import { useAdminAccess } from "@/lib/hooks/use-admin-access";

export default function AnalyticsDashboardPage() {
  const { data: access } = useAdminAccess();
  return <AnalyticsDashboard isPlatformAdmin={access?.isPlatformAdmin} />;
}
