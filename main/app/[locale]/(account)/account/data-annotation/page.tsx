"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TaskListTab } from "@/components/task-review/TaskListTab";
import { DashboardTab } from "@/components/task-review/DashboardTab";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

export default function DataAnnotationPage() {
  const t = useTranslations("TaskReview");
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") || "tasks";

  return (
    <div className="container mx-auto px-4 py-8">
      <Tabs defaultValue={defaultTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="tasks">{t("tasks")}</TabsTrigger>
          <TabsTrigger value="dashboard">{t("dashboard")}</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          <TaskListTab />
        </TabsContent>

        <TabsContent value="dashboard">
          <DashboardTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
