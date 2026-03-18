import type { Meta, StoryObj } from "@storybook/react";
import { Popover, PopoverTrigger, PopoverContent } from "./popover";
import { Button } from "./button";
import { Input } from "./input";

const meta: Meta<typeof Popover> = {
  title: "Components/Popover",
  component: Popover,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Popover>;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Open Popover</Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="grid gap-4">
          <div>
            <h4 className="font-medium leading-none">Gas Settings</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Configure the gas parameters for your transaction.
            </p>
          </div>
          <div className="grid gap-2">
            <div className="grid grid-cols-3 items-center gap-4">
              <label htmlFor="gas-limit" className="text-sm">
                Gas Limit
              </label>
              <Input
                id="gas-limit"
                defaultValue="21000"
                className="col-span-2"
              />
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <label htmlFor="max-fee" className="text-sm">
                Max Fee
              </label>
              <Input
                id="max-fee"
                defaultValue="0.005"
                className="col-span-2"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ),
};

export const WithInfo: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <span className="text-sm">Transaction Version</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            ?
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <p className="text-sm">
            The transaction version is a globally unique sequential number
            assigned to every transaction on the Movement network. It serves as
            the canonical ordering mechanism.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  ),
};

export const WithForm: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button>Set Custom Range</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div>
            <h4 className="font-medium leading-none">Block Range</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Specify the block range to query.
            </p>
          </div>
          <div className="grid gap-2">
            <label htmlFor="from-block" className="text-sm font-medium">
              From Block
            </label>
            <Input id="from-block" type="number" placeholder="0" />
          </div>
          <div className="grid gap-2">
            <label htmlFor="to-block" className="text-sm font-medium">
              To Block
            </label>
            <Input id="to-block" type="number" placeholder="Latest" />
          </div>
          <Button size="sm">Apply Range</Button>
        </div>
      </PopoverContent>
    </Popover>
  ),
};
