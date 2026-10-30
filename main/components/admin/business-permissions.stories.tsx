import BusinessPermissionsPage from "@/app/[locale]/admin/business-permissions/page";
import { BusinessPermissionsWorkspace } from "./business-permissions-workspace";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Meta, StoryObj } from "@storybook/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import {
  businessRole,
  type PermissionData,
  type PermissionChange,
  type SaveResult,
} from "@/lib/admin/permission-ui";

const user = {
  id: "qa-ui",
  name: "界面验收用户",
  emailHint: "q***@example.com",
  phoneHint: "138****0000",
  status: "ACTIVE",
  isSystemAdmin: false,
  isSuperAdmin: false,
};
const fixture: PermissionData = {
  isPlatformAdmin: true,
  roles: [{ role: "ACTIVITY_ADMIN", active: true }],
  target: user,
  questionnaireGrants: [
    { activity_id: "22", can_view_insights: true, can_export_insights: false },
  ],
  datasets: [
    {
      id: "68",
      name: "autumn-a",
      nickname: "自在禅城，舒度时光 - 地道岭南秋韵",
    },
    {
      id: "69",
      name: "autumn-b",
      nickname: "自在禅城，舒度时光 - 地道岭南秋韵",
    },
    { id: "72", name: "internal-test", nickname: "测试语料（内部）" },
    {
      id: "20",
      name: "long-title",
      nickname: "粤语勾漏片藤县方言口述文化语料集：长名称布局示例",
    },
  ],
  activities: [
    { id: "22", title: "声音征集活动" },
    { id: "23", title: "秋日粤语活动" },
    { id: "24", title: "多选验收活动甲" },
    { id: "25", title: "多选验收活动乙" },
  ],
  grants: [
    { scope_type: "activity", scope_id: "22", role: "ADMIN", actions: [] },
    {
      scope_type: "activity",
      scope_id: "23",
      role: "OPERATOR",
      actions: ["view", "approve", "reject"],
    },
  ],
};
function SearchPreview({ multiple = false }: { multiple?: boolean }) {
  const [client] = useState(() => {
    const q = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: Infinity,
          retry: false,
          refetchOnWindowFocus: false,
        },
      },
    });
    q.setQueryData(["business-permissions", ""], fixture);
    q.setQueryData(["business-permissions", "qa-ui"], fixture);
    q.setQueryData(["business-permissions", "qa-other"], {
      ...fixture,
      target: { ...user, id: "qa-other", name: "另一位用户" },
      roles: [],
      grants: [],
    });
    q.setQueryData(["business-user-search", "qa"], {
      users: multiple
        ? [user, { ...user, id: "qa-other", name: "另一位用户" }]
        : [user],
      hasMore: false,
    });
    return q;
  });
  return (
    <NextIntlClientProvider locale="zh-CN" messages={{}}>
      <QueryClientProvider client={client}>
        <p className="mb-4 text-sm text-muted-foreground">
          本地搜索样例：输入 qa。不要保存真实授权。
        </p>
        <BusinessPermissionsPage />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}
function WorkspacePreview({
  scoped = false,
  platformTarget = false,
  english = false,
  partial = false,
}: {
  scoped?: boolean;
  platformTarget?: boolean;
  english?: boolean;
  partial?: boolean;
}) {
  const [data, setData] = useState<PermissionData>(() =>
    scoped
      ? {
          ...fixture,
          isPlatformAdmin: false,
          roles: [],
          datasets: [],
          activities: fixture.activities.filter((a) => a.id === "22"),
          grants: [
            {
              scope_type: "activity",
              scope_id: "22",
              role: "OPERATOR",
              actions: ["view"],
            },
          ],
          questionnaireGrants: null,
        }
      : structuredClone(fixture),
  );
  const [busy, setBusy] = useState(false);
  const [calls, setCalls] = useState<PermissionChange[]>([]);
  const [failedOnce, setFailedOnce] = useState(false);
  const save = async (changes: PermissionChange[]): Promise<SaveResult[]> => {
    setBusy(true);
    setCalls(changes);
    const result: SaveResult[] = [];
    for (const change of changes) {
      if (
        partial &&
        !failedOnce &&
        change.kind === "scope" &&
        change.scopeId === "25"
      ) {
        setFailedOnce(true);
        result.push({
          change,
          ok: false,
          error: "样例：该项第一次保存失败，重试可成功",
        });
        continue;
      }
      setData((prev) => {
        if (change.kind === "business")
          return {
            ...prev,
            roles: [
              ...prev.roles.filter((r) => r.role !== change.role),
              { role: change.role, active: change.active },
            ],
            grants: change.active
              ? prev.grants
              : prev.grants.filter(
                  (g) =>
                    !(
                      g.role === "ADMIN" &&
                      businessRole(g.scope_type) === change.role
                    ),
                ),
          };
        const remaining = prev.grants.filter(
          (g) =>
            !(
              g.scope_type === change.scopeType && g.scope_id === change.scopeId
            ),
        );
        return {
          ...prev,
          grants: change.active
            ? [
                ...remaining,
                {
                  scope_type: change.scopeType,
                  scope_id: change.scopeId,
                  role: change.role,
                  actions: change.actions,
                },
              ]
            : remaining,
        };
      });
      result.push({ change, ok: true });
    }
    setBusy(false);
    return result;
  };
  return (
    <NextIntlClientProvider locale={english ? "en" : "zh-CN"} messages={{}}>
      <div className="max-w-5xl space-y-4">
        <p className="text-sm text-muted-foreground">
          交互样例：所有保存只更新内存，不发送授权请求。
        </p>
        <BusinessPermissionsWorkspace
          data={data}
          user={{ ...user, isSystemAdmin: platformTarget }}
          busy={busy}
          onSave={save}
        />
        {calls.length > 0 && (
          <p className="text-xs text-muted-foreground">
            样例回调：{JSON.stringify(calls)}
          </p>
        )}
      </div>
    </NextIntlClientProvider>
  );
}
const meta: Meta = {
  title: "Admin/Business permissions",
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { render: () => <SearchPreview /> };
export const MultipleMatches: Story = {
  render: () => <SearchPreview multiple />,
};
export const Interactive: Story = { render: () => <WorkspacePreview /> };
export const ScopedAdmin: Story = { render: () => <WorkspacePreview scoped /> };
export const PlatformUser: Story = {
  render: () => <WorkspacePreview platformTarget />,
};
export const PartialSave: Story = {
  render: () => <WorkspacePreview partial />,
};
export const English: Story = { render: () => <WorkspacePreview english /> };
