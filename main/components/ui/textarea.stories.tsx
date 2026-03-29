import type { Meta, StoryObj } from "@storybook/react";
import { Textarea } from "./textarea";

const meta: Meta<typeof Textarea> = {
  title: "Components/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  argTypes: {
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
    rows: { control: "number" },
  },
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  args: {
    placeholder: "Tell us about yourself...",
  },
};

export const WithValue: Story = {
  args: {
    defaultValue:
      "粤语，又称广东话、广府话，是汉语的一种方言，主要流通于广东省珠江三角洲地区、香港及澳门。",
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-1.5">
      <label htmlFor="bio" className="text-sm font-medium">
        Bio
      </label>
      <Textarea
        id="bio"
        placeholder="Tell us about yourself"
        className="min-h-[100px]"
      />
      <p className="text-xs text-muted-foreground">
        This will be displayed on your public profile.
      </p>
    </div>
  ),
};

export const RuleInput: Story = {
  render: () => (
    <div className="grid w-full gap-1.5">
      <label htmlFor="rule" className="text-sm font-medium">
        规则编译检查
      </label>
      <Textarea
        id="rule"
        placeholder="请输入要编译的规则..."
        rows={6}
        className="bg-background border-border"
      />
    </div>
  ),
};

export const JsonEditor: Story = {
  render: () => (
    <div className="grid w-full gap-1.5">
      <label htmlFor="json" className="text-sm font-medium">
        Corpus Note (JSON)
      </label>
      <Textarea
        id="json"
        className="font-mono text-xs"
        rows={8}
        defaultValue={JSON.stringify(
          {
            context: {
              pinyin: ["jyut6", "jyu5"],
              meaning: ["Cantonese language", "粤语"],
              page: 42,
              number: "A-0156",
            },
            contributor: "张三",
          },
          null,
          2
        )}
      />
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    placeholder: "This field is read-only",
    disabled: true,
  },
};
