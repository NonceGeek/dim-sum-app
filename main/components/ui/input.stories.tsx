import type { Meta, StoryObj } from "@storybook/react";
import { Search } from "lucide-react";
import { Input } from "./input";

const meta: Meta<typeof Input> = {
  title: "Components/Input",
  component: Input,
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: "select",
      options: ["text", "password", "email", "number", "search", "tel", "url"],
    },
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: "搜索分类...",
    type: "search",
  },
};

export const WithValue: Story = {
  args: {
    defaultValue: "广州话正音字典",
    type: "text",
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-1.5">
      <label htmlFor="pinyin" className="text-sm font-medium">
        粤音
      </label>
      <Input id="pinyin" placeholder="输入粤拼，如 jyut6 jyu5" />
    </div>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <div className="relative w-full max-w-sm">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
      <Input
        placeholder="Search by name or nickname..."
        className="pl-10 bg-secondary border-border text-foreground"
      />
    </div>
  ),
};

export const Number: Story = {
  render: () => (
    <div className="grid w-full max-w-[120px] gap-1.5">
      <label htmlFor="page" className="text-sm font-medium">
        Page
      </label>
      <Input
        id="page"
        type="number"
        placeholder="Go to Page"
        min={1}
        className="text-center"
      />
    </div>
  ),
};

export const File: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-1.5">
      <label htmlFor="avatar" className="text-sm font-medium">
        Avatar
      </label>
      <Input id="avatar" type="file" accept="image/*" />
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    placeholder: "Read-only field",
    disabled: true,
  },
};
