import type { Meta, StoryObj } from "@storybook/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "./card";
import { Button } from "./button";

const meta: Meta<typeof Card> = {
  title: "Components/Card",
  component: Card,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-[380px]">
      <CardHeader>
        <CardTitle>Transaction Summary</CardTitle>
        <CardDescription>
          Overview of the latest on-chain transaction.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">
          Transfer of 1,250 MOVE tokens from 0x1a2b...3c4d to 0x5e6f...7a8b
          completed successfully.
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm">
          View Details
        </Button>
      </CardFooter>
    </Card>
  ),
};

export const WithAction: Story = {
  render: () => (
    <Card className="w-[380px]">
      <CardHeader>
        <CardTitle>Network Statistics</CardTitle>
        <CardDescription>Current epoch performance metrics.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm">
            Refresh
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">TPS</span>
            <span>2,847</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Active Validators</span>
            <span>114</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Transactions</span>
            <span>1.2B</span>
          </div>
        </div>
      </CardContent>
    </Card>
  ),
};

export const Minimal: Story = {
  render: () => (
    <Card className="w-[380px]">
      <CardHeader>
        <CardTitle>Quick Stats</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">12,459</p>
        <p className="text-sm text-muted-foreground">
          Transactions in the last hour
        </p>
      </CardContent>
    </Card>
  ),
};
