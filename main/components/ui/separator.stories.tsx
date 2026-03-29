import type { Meta, StoryObj } from "@storybook/react";
import { Separator } from "./separator";

const meta: Meta<typeof Separator> = {
  title: "Components/Separator",
  component: Separator,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Separator>;

export const Default: Story = {
  render: () => (
    <div className="w-full max-w-sm">
      <div className="space-y-1">
        <h4 className="text-sm font-medium leading-none">广州话正音字典</h4>
        <p className="text-sm text-muted-foreground">
          ZYZD — 收录广州话标准音的权威字典
        </p>
      </div>
      <Separator className="my-4" />
      <div className="space-y-1">
        <h4 className="text-sm font-medium leading-none">Status</h4>
        <p className="text-sm text-muted-foreground">INPROGRESS</p>
      </div>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-5 items-center gap-4 text-sm">
      <span>Home</span>
      <Separator orientation="vertical" />
      <span>Library</span>
      <Separator orientation="vertical" />
      <span>App Store</span>
      <Separator orientation="vertical" />
      <span>Docs</span>
    </div>
  ),
};

export const InDetailsList: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <div className="flex justify-between py-3">
        <span className="text-sm text-muted-foreground">分类</span>
        <span className="text-sm font-medium">广州话正音字典</span>
      </div>
      <Separator />
      <div className="flex justify-between py-3">
        <span className="text-sm text-muted-foreground">词条数</span>
        <span className="text-sm font-medium">12,450</span>
      </div>
      <Separator />
      <div className="flex justify-between py-3">
        <span className="text-sm text-muted-foreground">贡献者</span>
        <span className="text-sm font-medium">15 人</span>
      </div>
      <Separator />
      <div className="flex justify-between py-3">
        <span className="text-sm text-muted-foreground">大小</span>
        <span className="text-sm font-medium">2.3 GB</span>
      </div>
    </div>
  ),
};

export const WithHeading: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <h3 className="text-lg font-semibold">语料集概览</h3>
      <p className="text-sm text-muted-foreground">
        查看所有分类的统计信息与权限状态。
      </p>
      <Separator className="my-4" />
      <div className="grid gap-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">总分类数</span>
          <span className="font-medium">12</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">总词条数</span>
          <span className="font-medium">45,230</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">活跃标注员</span>
          <span className="font-medium">32</span>
        </div>
      </div>
    </div>
  ),
};
