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
    children: "LEARNER",
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Badge variant="default">Active</Badge>
      <Badge variant="secondary">TAGGER_PARTNER</Badge>
      <Badge variant="destructive">Unverified</Badge>
      <Badge variant="outline">RAW</Badge>
    </div>
  ),
};

export const Roles: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge variant="secondary">LEARNER</Badge>
      <Badge variant="secondary">TAGGER_PARTNER</Badge>
      <Badge variant="secondary">TAGGER_OUTSOURCING</Badge>
      <Badge variant="secondary">RESEARCHER</Badge>
    </div>
  ),
};

export const Permissions: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge className="bg-info text-info-foreground">READ</Badge>
      <Badge className="bg-warning text-warning-foreground">WRITE</Badge>
      <Badge className="bg-success text-success-foreground">CREATE</Badge>
      <Badge variant="default">FULL</Badge>
    </div>
  ),
};

export const CorpusStatus: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge variant="outline">RAW</Badge>
      <Badge variant="outline">INPROGRESS</Badge>
      <Badge variant="secondary">置顶</Badge>
    </div>
  ),
};
