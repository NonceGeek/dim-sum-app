import type { Meta, StoryObj } from "@storybook/react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./select";

const meta: Meta<typeof Select> = {
  title: "Components/Select",
  component: Select,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Filter by role" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Roles</SelectItem>
        <SelectItem value="LEARNER">Learner</SelectItem>
        <SelectItem value="TAGGER_PARTNER">Tagger Partner</SelectItem>
        <SelectItem value="TAGGER_OUTSOURCING">Tagger Outsourcing</SelectItem>
        <SelectItem value="RESEARCHER">Researcher</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const Permissions: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Permission level" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="READ">READ</SelectItem>
        <SelectItem value="WRITE">WRITE</SelectItem>
        <SelectItem value="CREATE">CREATE</SelectItem>
        <SelectItem value="FULL">FULL</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const Small: Story = {
  render: () => (
    <Select>
      <SelectTrigger size="sm" className="w-[160px]">
        <SelectValue placeholder="Rows per page" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="10">10 rows</SelectItem>
        <SelectItem value="25">25 rows</SelectItem>
        <SelectItem value="50">50 rows</SelectItem>
        <SelectItem value="100">100 rows</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Select disabled>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Not available" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">None</SelectItem>
      </SelectContent>
    </Select>
  ),
};
