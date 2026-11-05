import { Suspense } from "react";
import { AssistantPage } from "@/components/assistant/assistant-page";

export default function AssistantRoute() {
  return (
    <Suspense>
      <AssistantPage />
    </Suspense>
  );
}
