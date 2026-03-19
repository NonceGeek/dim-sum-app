import type { Meta, StoryObj } from "@storybook/react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

const meta: Meta<typeof Tabs> = {
  title: "Components/Tabs",
  component: Tabs,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-[500px]">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="entries">词条</TabsTrigger>
        <TabsTrigger value="history">修改记录</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <div className="rounded-md border p-4 text-sm">
          <p>
            广州话正音字典：收录 12,450 个词条，由 15 位标注员协作维护。
          </p>
        </div>
      </TabsContent>
      <TabsContent value="entries">
        <div className="rounded-md border p-4 text-sm">
          <p>最近更新：「粤」jyut6 — 广东省的简称。</p>
        </div>
      </TabsContent>
      <TabsContent value="history">
        <div className="rounded-md border p-4 text-sm">
          <p>张三 于 2026-03-18 修改了「声」的粤音标注。</p>
        </div>
      </TabsContent>
    </Tabs>
  ),
};

export const MultipleTabs: Story = {
  render: () => (
    <Tabs defaultValue="corpus" className="w-[500px]">
      <TabsList>
        <TabsTrigger value="corpus">语料集</TabsTrigger>
        <TabsTrigger value="apps">应用</TabsTrigger>
        <TabsTrigger value="users">用户</TabsTrigger>
        <TabsTrigger value="logs">操作日志</TabsTrigger>
      </TabsList>
      <TabsContent value="corpus">
        <div className="rounded-md border p-4 text-sm">
          <p>12 个语料分类，共 45,230 个词条。</p>
        </div>
      </TabsContent>
      <TabsContent value="apps">
        <div className="rounded-md border p-4 text-sm">
          <p>8 个已上架应用，涵盖学习、游戏和 AI 工具。</p>
        </div>
      </TabsContent>
      <TabsContent value="users">
        <div className="rounded-md border p-4 text-sm">
          <p>1,247 名注册用户，其中活跃标注员 32 名。</p>
        </div>
      </TabsContent>
      <TabsContent value="logs">
        <div className="rounded-md border p-4 text-sm">
          <p>最近 24 小时：128 次权限变更，45 次角色调整。</p>
        </div>
      </TabsContent>
    </Tabs>
  ),
};
