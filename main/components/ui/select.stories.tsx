import type { Meta, StoryObj } from "@storybook/react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
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
        <SelectValue placeholder="Select network" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="mainnet">Mainnet</SelectItem>
        <SelectItem value="testnet">Testnet</SelectItem>
        <SelectItem value="devnet">Devnet</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const WithGroups: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-[240px]">
        <SelectValue placeholder="Select transaction type" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>User Transactions</SelectLabel>
          <SelectItem value="transfer">Token Transfer</SelectItem>
          <SelectItem value="swap">Token Swap</SelectItem>
          <SelectItem value="stake">Stake</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>System Transactions</SelectLabel>
          <SelectItem value="block_metadata">Block Metadata</SelectItem>
          <SelectItem value="state_checkpoint">State Checkpoint</SelectItem>
          <SelectItem value="genesis">Genesis</SelectItem>
        </SelectGroup>
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
