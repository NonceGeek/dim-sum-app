import BusinessPermissionsPage from "@/app/[locale]/admin/business-permissions/page";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Meta, StoryObj } from "@storybook/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";

const fixture = {
  isPlatformAdmin: true,
  roles: [],
  datasets: [
    { id: "72", name: "internal-test", nickname: "测试语料（内部）" },
    {
      id: "20",
      name: "long-title",
      nickname: "粤语勾漏片藤县方言口述文化语料集：长名称布局示例",
    },
  ],
  activities: [{ id: "22", title: "声音征集活动" }],
  grants: [
    {
      scope_type: "activity",
      scope_id: "22",
      role: "OPERATOR",
      actions: ["view", "approve", "reject"],
    },
  ],
};

function Preview() {
  const [client] = useState(() => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: Infinity,
          retry: false,
          refetchOnWindowFocus: false,
        },
      },
    });
    queryClient.setQueryData(["business-permissions", ""], fixture);
    queryClient.setQueryData(["business-permissions", "qa-ui"], fixture);
    queryClient.setQueryData(["business-user-search", "qa"], {
      users: [{ id: "qa-ui", name: "界面验收用户" }],
    });
    return queryClient;
  });
  return (
    <NextIntlClientProvider locale="zh" messages={{}}>
      <QueryClientProvider client={client}>
        <p className="mb-4 text-sm text-muted-foreground">
          静态界面预览：搜索 qa 并选择用户，检查授权表单。数据为虚构样例。
        </p>
        <BusinessPermissionsPage />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

const meta: Meta = {
  title: "Admin/Business permissions",
  component: Preview,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
