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
        Accept terms and conditions
      </label>
    </div>
  ),
};

export const Checked: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="checked" defaultChecked />
      <label htmlFor="checked" className="text-sm font-medium leading-none">
        Show token balances
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

export const MultipleOptions: Story = {
  render: () => (
    <div className="grid gap-3">
      <h4 className="text-sm font-medium">Transaction Filters</h4>
      <div className="flex items-center gap-2">
        <Checkbox id="user-tx" defaultChecked />
        <label htmlFor="user-tx" className="text-sm leading-none">
          User transactions
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="block-metadata" defaultChecked />
        <label htmlFor="block-metadata" className="text-sm leading-none">
          Block metadata
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="state-checkpoint" />
        <label htmlFor="state-checkpoint" className="text-sm leading-none">
          State checkpoints
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="genesis" />
        <label htmlFor="genesis" className="text-sm leading-none">
          Genesis transactions
        </label>
      </div>
    </div>
  ),
};
