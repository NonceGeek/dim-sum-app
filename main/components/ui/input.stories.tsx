import type { Meta, StoryObj } from "@storybook/react";
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
    placeholder: "Enter your email",
    type: "email",
  },
};

export const WithValue: Story = {
  args: {
    defaultValue: "0x1a2b3c4d5e6f...",
    type: "text",
  },
};

export const Password: Story = {
  args: {
    placeholder: "Enter password",
    type: "password",
  },
};

export const Disabled: Story = {
  args: {
    placeholder: "Cannot edit this field",
    disabled: true,
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-1.5">
      <label htmlFor="wallet" className="text-sm font-medium">
        Wallet Address
      </label>
      <Input id="wallet" placeholder="0x..." />
    </div>
  ),
};

export const File: Story = {
  args: {
    type: "file",
  },
};
