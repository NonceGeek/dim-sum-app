import type { Meta, StoryObj } from "@storybook/react";
import { Separator } from "./separator";

const meta: Meta<typeof Separator> = {
  title: "Components/Separator",
  component: Separator,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Separator>;

export const Default: Story = {
  render: () => (
    <div className="w-full max-w-sm">
      <div className="space-y-1">
        <h4 className="text-sm font-medium leading-none">Transaction Hash</h4>
        <p className="text-sm text-muted-foreground">
          0x1a2b3c4d5e6f7a8b9c0d1e2f...
        </p>
      </div>
      <Separator className="my-4" />
      <div className="space-y-1">
        <h4 className="text-sm font-medium leading-none">Status</h4>
        <p className="text-sm text-muted-foreground">Confirmed</p>
      </div>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-5 items-center gap-4 text-sm">
      <span>Transactions</span>
      <Separator orientation="vertical" />
      <span>Blocks</span>
      <Separator orientation="vertical" />
      <span>Accounts</span>
      <Separator orientation="vertical" />
      <span>Validators</span>
    </div>
  ),
};

export const InDetailsList: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <div className="flex justify-between py-3">
        <span className="text-sm text-muted-foreground">Version</span>
        <span className="text-sm font-medium">843,291,042</span>
      </div>
      <Separator />
      <div className="flex justify-between py-3">
        <span className="text-sm text-muted-foreground">Block</span>
        <span className="text-sm font-medium">8,432,109</span>
      </div>
      <Separator />
      <div className="flex justify-between py-3">
        <span className="text-sm text-muted-foreground">Timestamp</span>
        <span className="text-sm font-medium">2024-12-15 14:23:07 UTC</span>
      </div>
      <Separator />
      <div className="flex justify-between py-3">
        <span className="text-sm text-muted-foreground">Gas Used</span>
        <span className="text-sm font-medium">1,200 units</span>
      </div>
    </div>
  ),
};

export const WithHeading: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <h3 className="text-lg font-semibold">Account Overview</h3>
      <p className="text-sm text-muted-foreground">
        View balances, transactions, and resources for this account.
      </p>
      <Separator className="my-4" />
      <div className="grid gap-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Balance</span>
          <span className="font-medium">12,450.00 MOVE</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Transactions</span>
          <span className="font-medium">1,247</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Resources</span>
          <span className="font-medium">23</span>
        </div>
      </div>
    </div>
  ),
};
