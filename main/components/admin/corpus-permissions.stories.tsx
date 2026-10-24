import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import AdminPermissionsPage from "@/app/[locale]/admin/permissions/page";
import messages from "@/messages/zh-CN.json";

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
    queryClient.setQueryData(["admin-permissions", "", ""], {
      permissions: [],
    });
    queryClient.setQueryData(["admin-categories-list"], {
      categories: [
        {
          id: 68,
          name: "activity-autumn-a",
          nickname: "自在禅城，舒度时光 - 地道岭南秋韵",
        },
        {
          id: 69,
          name: "activity-autumn-b",
          nickname: "自在禅城，舒度时光 - 地道岭南秋韵",
        },
        {
          id: 49,
          name: "activity-memory-a",
          nickname: "「粤菜记忆」声音资源征集",
        },
        {
          id: 57,
          name: "activity-memory-b",
          nickname: "「粤菜记忆」声音资源征集",
        },
        { id: 12, name: "internal-test", nickname: "测试语料（内部）" },
      ],
    });
    queryClient.setQueryData(["admin-users-search", ""], { users: [] });
    return queryClient;
  });
  return (
    <NextIntlClientProvider
      locale="zh-CN"
      messages={{ AdminPermissions: messages.AdminPermissions }}
    >
      <QueryClientProvider client={client}>
        <p className="mb-4 text-sm text-muted-foreground">
          本地样例：只检查分类搜索与选择，不提交权限变更。
        </p>
        <AdminPermissionsPage />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}
const meta: Meta = { title: "Admin/Corpus permissions", component: Preview };
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
