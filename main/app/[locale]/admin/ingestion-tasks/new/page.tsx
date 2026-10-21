"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { TaskForm } from "@/components/ingestion/task-form";

export default function NewIngestionTaskPage() {
  const params = useSearchParams();
  // 第一次上传会自动建草稿并替换地址，待办参数随之消失，这里只取首次的值
  const [lead] = useState(() => {
    const id = params.get("lead");
    return id
      ? {
          id,
          leadNo: params.get("leadNo") ?? "",
          datasetName: params.get("dataset") ?? "",
          ingestionType: params.get("type") ?? "",
        }
      : undefined;
  });
  return <TaskForm lead={lead} />;
}
