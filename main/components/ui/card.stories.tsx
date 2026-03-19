import type { Meta, StoryObj } from "@storybook/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./card";
import { Badge } from "./badge";
import { Users, BookOpen, FileText } from "lucide-react";

const meta: Meta<typeof Card> = {
  title: "Components/Card",
  component: Card,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-[380px]">
      <CardHeader>
        <CardTitle>语料分类管理</CardTitle>
        <CardDescription>
          管理和查看所有粤语语料分类的状态与权限。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">分类数</span>
            <span>12</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">公开分类</span>
            <span>8</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">总词条数</span>
            <span>45,230</span>
          </div>
        </div>
      </CardContent>
    </Card>
  ),
};

export const StatCard: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4 w-[640px]">
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">1,247</div>
          <p className="text-xs text-muted-foreground">Active users this month</p>
        </CardContent>
      </Card>
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">语料分类</CardTitle>
          <BookOpen className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">12</div>
          <p className="text-xs text-muted-foreground">8 个公开</p>
        </CardContent>
      </Card>
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">总词条</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">45,230</div>
          <p className="text-xs text-muted-foreground">本月新增 320</p>
        </CardContent>
      </Card>
    </div>
  ),
};

export const CorpusCard: Story = {
  render: () => (
    <Card className="w-[380px] p-3 hover:shadow-lg transition-shadow cursor-pointer hover:bg-accent">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">广州话正音字典</h3>
          <Badge variant="secondary">置顶</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          收录广州话标准音的权威字典，包含粤音、释义及例词。
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>大小: 2.3 GB</span>
          <span>状态: INPROGRESS</span>
        </div>
      </div>
    </Card>
  ),
};
