import Page from "@/app/[locale]/admin/search-miniprogram/page";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Meta, StoryObj } from "@storybook/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
const day = (offset = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(
    new Date(Date.now() + offset * 86400000),
  );
const record = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  type: "audio_issue",
  description: "界面样例：音频加载失败，请核查资源。",
  entryId: "6f1c3d9a-1b2c-4d5e-8f90-123456789abc",
  userId: null,
  status: "OPEN",
  note: "",
  handledBy: null,
  handledAt: null,
  createdAt: "2026-10-23T04:00:00.000Z",
  updatedAt: "2026-10-23T04:00:00.000Z",
};
function Preview() {
  const [client] = useState(() => {
    const c = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    for (const status of [
      "all",
      "OPEN",
      "IN_PROGRESS",
      "RESOLVED",
      "DISMISSED",
    ])
      for (const type of [
        "all",
        "audio_issue",
        "content_error",
        "suggestion",
        "other",
      ])
        c.setQueryData(["search-app-feedback", status, type, 1], {
          items:
            (status === "all" || status === "OPEN") &&
            (type === "all" || type === "audio_issue")
              ? [record]
              : [],
          total:
            (status === "all" || status === "OPEN") &&
            (type === "all" || type === "audio_issue")
              ? 1
              : 0,
          page: 1,
          pageSize: 20,
        });
    c.setQueryData(["search-app-analytics", { from: day(-6), to: day() }], {
      data: {
        requests: 128,
        emptyRate: 0.12,
        directRate: 0.68,
        errors: 2,
        visitors: 40,
        result_clicks: 76,
        audio_plays: 52,
        audio_errors: 3,
        share_triggers: 9,
        feedbacks: 1,
        feedback_errors: 0,
      },
    });
    return c;
  });
  return (
    <NextIntlClientProvider locale="zh-CN" messages={{}}>
      <QueryClientProvider client={client}>
        <p className="mb-4 text-sm text-muted-foreground">
          界面验收静态样例，非真实用户数据。
        </p>
        <Page />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}
const meta: Meta = {
  title: "Admin/Search mini-program",
  component: Preview,
  parameters: { layout: "fullscreen" },
};
export default meta;
export const Default: StoryObj<typeof meta> = {};
