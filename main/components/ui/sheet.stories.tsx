import type { Meta, StoryObj } from "@storybook/react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "./sheet";
import { Button } from "./button";
import { Input } from "./input";

const meta: Meta<typeof Sheet> = {
  title: "Components/Sheet",
  component: Sheet,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Sheet>;

export const Default: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open Sheet</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Account Settings</SheetTitle>
          <SheetDescription>
            Update your account preferences and display options.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4">
          <div className="grid gap-2">
            <label htmlFor="display-name" className="text-sm font-medium">
              Display Name
            </label>
            <Input id="display-name" defaultValue="MovementUser" />
          </div>
          <div className="grid gap-2">
            <label htmlFor="rpc-url" className="text-sm font-medium">
              Custom RPC URL
            </label>
            <Input
              id="rpc-url"
              placeholder="https://rpc.movementlabs.xyz"
            />
          </div>
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
          <Button>Save Changes</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

export const LeftSide: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open Left Sheet</Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>
            Browse the Movement explorer sections.
          </SheetDescription>
        </SheetHeader>
        <nav className="grid gap-2 px-4">
          <Button variant="ghost" className="justify-start">
            Transactions
          </Button>
          <Button variant="ghost" className="justify-start">
            Blocks
          </Button>
          <Button variant="ghost" className="justify-start">
            Accounts
          </Button>
          <Button variant="ghost" className="justify-start">
            Validators
          </Button>
          <Button variant="ghost" className="justify-start">
            Analytics
          </Button>
        </nav>
      </SheetContent>
    </Sheet>
  ),
};

export const TopSide: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open Top Sheet</Button>
      </SheetTrigger>
      <SheetContent side="top">
        <SheetHeader>
          <SheetTitle>Network Status</SheetTitle>
          <SheetDescription>
            Current network performance and health indicators.
          </SheetDescription>
        </SheetHeader>
        <div className="flex gap-8 px-4 pb-4">
          <div>
            <p className="text-sm text-muted-foreground">TPS</p>
            <p className="text-2xl font-bold">1,247</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Block Height</p>
            <p className="text-2xl font-bold">8,432,109</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Finality</p>
            <p className="text-2xl font-bold">1.2s</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  ),
};

export const BottomSide: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open Bottom Sheet</Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Transaction Summary</SheetTitle>
          <SheetDescription>
            Review the details of this transaction before proceeding.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-2 px-4 pb-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">From</span>
            <span className="font-mono">0x1a2b...3c4d</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">To</span>
            <span className="font-mono">0x5e6f...7a8b</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Amount</span>
            <span>250 MOVE</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Gas Fee</span>
            <span>0.0012 MOVE</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  ),
};
