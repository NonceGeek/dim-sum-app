import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./badge";

const meta: Meta<typeof Badge> = {
  title: "Components/Badge",
  component: Badge,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "destructive", "outline"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: {
    children: "Success",
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Badge variant="default">Confirmed</Badge>
      <Badge variant="secondary">Pending</Badge>
      <Badge variant="destructive">Failed</Badge>
      <Badge variant="outline">User Transaction</Badge>
    </div>
  ),
};

export const AsLink: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Badge asChild>
        <a href="#">View Module</a>
      </Badge>
      <Badge variant="outline" asChild>
        <a href="#">0x1::aptos_coin</a>
      </Badge>
    </div>
  ),
};
