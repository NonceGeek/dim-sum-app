"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { json } from "@/components/library-ops/ops-shared";
import { type LeadPrefill, TaskForm } from "@/components/ingestion/task-form";

type LeadItem = {
  id: string;
  leadNo: string;
  proposedDatasetName: string;
  targetIngestionType: string;
  ingestionTaskId: string | null;
  application: { sourceCollectionMethod: string; modalities: string[] };
};

export default function NewIngestionTaskPage() {
  const t = useTranslations("IngestionTasks");
  const router = useRouter();
  const params = useSearchParams();
  // 第一次上传会自动建草稿并替换地址，待办参数随之消失，这里只取首次的值
  const [leadId] = useState(() => params.get("lead"));
  const lead = useQuery({
    queryKey: ["ingestion-lead", leadId],
    enabled: !!leadId,
    // 表单只在首次渲染时读取预填，之后不再刷新
    staleTime: Infinity,
    queryFn: async () => {
      const { items } = await json<{ items: LeadItem[] }>(
        await fetch(`/api/admin/ingestion-leads?${new URLSearchParams({ id: leadId! })}`),
      );
      const item = items[0];
      if (!item) throw new Error(t("create.leadNotFound"));
      return item;
    },
  });
  const existingTask = lead.data?.ingestionTaskId;

  // 待办已有任务时直接打开那个任务
  useEffect(() => {
    if (existingTask) router.replace(`/admin/ingestion-tasks/${existingTask}`);
  }, [existingTask, router]);

  if (!leadId) return <TaskForm />;
  if (lead.isError) return <p className="text-destructive">{(lead.error as Error).message}</p>;
  if (!lead.data || existingTask) return <p className="text-muted-foreground">{t("loading")}</p>;
  const prefill: LeadPrefill = {
    id: lead.data.id,
    leadNo: lead.data.leadNo,
    datasetName: lead.data.proposedDatasetName,
    ingestionType: lead.data.targetIngestionType,
    sourceCollectionMethod: lead.data.application.sourceCollectionMethod,
    modalities: lead.data.application.modalities,
  };
  return <TaskForm lead={prefill} />;
}
