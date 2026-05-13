"use client";

import { useEffect, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TaskListTab } from "@/components/task-review/TaskListTab";
import { DashboardTab } from "@/components/task-review/DashboardTab";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useUserTaskPermissions } from "@/lib/hooks/useTaskReview";
import { useCategoryStore } from "@/lib/stores/category-store";

export default function DataAnnotationPage() {
  const t = useTranslations("TaskReview");
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") || "tasks";
  const { fetchCategories, categories } = useCategoryStore();
  const { data: permissions } = useUserTaskPermissions();

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const datasets = useMemo(
    () =>
      (permissions?.writeCorpora ?? []).map((name) => {
        const category = categories.find((cat) => cat.name === name);
        return {
          label: category?.nickname || category?.name || name,
          value: name,
        };
      }),
    [categories, permissions?.writeCorpora]
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <Tabs defaultValue={defaultTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="tasks">{t("tasks")}</TabsTrigger>
          <TabsTrigger value="dashboard">{t("dashboard")}</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          <TaskListTab datasets={datasets} />
        </TabsContent>

        <TabsContent value="dashboard">
          <DashboardTab datasets={datasets} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
