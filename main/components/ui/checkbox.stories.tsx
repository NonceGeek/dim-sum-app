import type { Meta, StoryObj } from "@storybook/react";
import { Checkbox } from "./checkbox";

const meta: Meta<typeof Checkbox> = {
  title: "Components/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  argTypes: {
    checked: { control: "boolean" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="terms" />
      <label
        htmlFor="terms"
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        I agree to the Terms of Service and Privacy Policy
      </label>
    </div>
  ),
};

export const Checked: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="checked" defaultChecked />
      <label htmlFor="checked" className="text-sm font-medium leading-none">
        公开此分类
      </label>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <Checkbox id="disabled-unchecked" disabled />
        <label
          htmlFor="disabled-unchecked"
          className="text-sm font-medium leading-none opacity-50"
        >
          Feature unavailable
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="disabled-checked" disabled defaultChecked />
        <label
          htmlFor="disabled-checked"
          className="text-sm font-medium leading-none opacity-50"
        >
          Always enabled
        </label>
      </div>
    </div>
  ),
};

export const CategoryFilter: Story = {
  render: () => (
    <div className="grid gap-3">
      <h4 className="text-sm font-medium">选择分类筛选</h4>
      <div className="flex items-center gap-2">
        <Checkbox id="zyzd" defaultChecked />
        <label htmlFor="zyzd" className="text-sm leading-none">
          广州话正音字典
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="yyjq" defaultChecked />
        <label htmlFor="yyjq" className="text-sm leading-none">
          粤语金曲
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="movie" />
        <label htmlFor="movie" className="text-sm leading-none">
          粤语电影台词
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="drama" />
        <label htmlFor="drama" className="text-sm leading-none">
          粤剧唱词
        </label>
      </div>
    </div>
  ),
};
