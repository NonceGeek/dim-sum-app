import type { Meta, StoryObj } from "@storybook/react";
import { Textarea } from "./textarea";

const meta: Meta<typeof Textarea> = {
  title: "Components/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  argTypes: {
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
    rows: { control: "number" },
  },
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  args: {
    placeholder: "Enter a message...",
  },
};

export const WithValue: Story = {
  args: {
    defaultValue:
      "0x1::aptos_account::transfer\n\nTransfers MOVE tokens from the sender to the recipient address. This function handles both existing and new accounts.",
  },
};

export const Disabled: Story = {
  args: {
    placeholder: "This field is read-only",
    disabled: true,
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-1.5">
      <label htmlFor="notes" className="text-sm font-medium">
        Transaction Notes
      </label>
      <Textarea
        id="notes"
        placeholder="Add a note to this transaction..."
      />
      <p className="text-xs text-muted-foreground">
        Notes are stored locally and not submitted on-chain.
      </p>
    </div>
  ),
};

export const CodeBlock: Story = {
  render: () => (
    <div className="grid w-full gap-1.5">
      <label htmlFor="payload" className="text-sm font-medium">
        Raw Payload
      </label>
      <Textarea
        id="payload"
        className="font-mono text-xs"
        rows={8}
        defaultValue={JSON.stringify(
          {
            function: "0x1::coin::transfer",
            type_arguments: ["0x1::aptos_coin::AptosCoin"],
            arguments: ["0x5e6f7a8b9c0d1e2f", "1000000"],
          },
          null,
          2
        )}
      />
    </div>
  ),
};
