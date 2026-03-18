import type { Meta, StoryObj } from "@storybook/react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./dialog";
import { Button } from "./button";
import { Input } from "./input";

const meta: Meta<typeof Dialog> = {
  title: "Components/Dialog",
  component: Dialog,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Dialog>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transaction Details</DialogTitle>
          <DialogDescription>
            Review the transaction before confirming.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="address" className="text-sm font-medium">
              Recipient Address
            </label>
            <Input id="address" defaultValue="0x1a2b3c4d5e6f..." />
          </div>
          <div className="grid gap-2">
            <label htmlFor="amount" className="text-sm font-medium">
              Amount (MOVE)
            </label>
            <Input id="amount" type="number" defaultValue="100" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const Informational: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>View Raw JSON</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Raw Transaction Data</DialogTitle>
          <DialogDescription>
            The full transaction payload in JSON format.
          </DialogDescription>
        </DialogHeader>
        <pre className="rounded-md bg-muted p-4 text-xs overflow-auto max-h-[300px]">
          {JSON.stringify(
            {
              hash: "0xabc123...",
              type: "user_transaction",
              sender: "0x1a2b3c...",
              sequence_number: 42,
              gas_used: 1200,
              success: true,
            },
            null,
            2
          )}
        </pre>
      </DialogContent>
    </Dialog>
  ),
};
