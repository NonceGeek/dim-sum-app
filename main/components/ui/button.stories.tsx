import type { Meta, StoryObj } from "@storybook/react";
import { Loader2, Search, Plus, Trash2, Settings } from "lucide-react";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "destructive",
        "outline",
        "secondary",
        "ghost",
        "link",
        "common",
      ],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: { children: "保存" },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="default">创建</Button>
      <Button variant="destructive">删除帐号</Button>
      <Button variant="outline">取消</Button>
      <Button variant="secondary">Revert</Button>
      <Button variant="ghost">Sign Out</Button>
      <Button variant="link">忘记密码?</Button>
      <Button variant="common">Apply</Button>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Button size="sm">Edit Profile</Button>
      <Button size="default">Search</Button>
      <Button size="lg">Sign In</Button>
      <Button variant="ghost" size="icon">
        <Settings className="h-4 w-4" />
      </Button>
    </div>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button>
        <Search className="w-4 h-4 mr-2" />
        Search
      </Button>
      <Button variant="outline">
        <Plus className="w-4 h-4 mr-2" />
        添加粤音
      </Button>
      <Button variant="destructive">
        <Trash2 className="w-4 h-4 mr-2" />
        Delete
      </Button>
      <Button disabled>
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Saving...
      </Button>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button disabled>Save</Button>
      <Button variant="destructive" disabled>
        Delete
      </Button>
      <Button variant="outline" disabled>
        Cancel
      </Button>
      <Button variant="secondary" disabled>
        Revert
      </Button>
    </div>
  ),
};
