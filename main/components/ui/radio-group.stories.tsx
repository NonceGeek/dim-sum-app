import type { Meta, StoryObj } from "@storybook/react";
import { RadioGroup, RadioGroupItem } from "./radio-group";

const meta: Meta<typeof RadioGroup> = {
  title: "Components/RadioGroup",
  component: RadioGroup,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof RadioGroup>;

export const Default: Story = {
  render: () => (
    <RadioGroup defaultValue="mainnet">
      <div className="flex items-center gap-2">
        <RadioGroupItem value="mainnet" id="mainnet" />
        <label htmlFor="mainnet" className="text-sm font-medium leading-none">
          Mainnet
        </label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="testnet" id="testnet" />
        <label htmlFor="testnet" className="text-sm font-medium leading-none">
          Testnet
        </label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="devnet" id="devnet" />
        <label htmlFor="devnet" className="text-sm font-medium leading-none">
          Devnet
        </label>
      </div>
    </RadioGroup>
  ),
};

export const WithDescriptions: Story = {
  render: () => (
    <RadioGroup defaultValue="standard">
      <div className="flex items-start gap-3">
        <RadioGroupItem value="standard" id="standard" className="mt-0.5" />
        <div className="grid gap-0.5">
          <label
            htmlFor="standard"
            className="text-sm font-medium leading-none"
          >
            Standard
          </label>
          <p className="text-sm text-muted-foreground">
            Default gas price, confirmed within 30 seconds.
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <RadioGroupItem value="fast" id="fast" className="mt-0.5" />
        <div className="grid gap-0.5">
          <label htmlFor="fast" className="text-sm font-medium leading-none">
            Fast
          </label>
          <p className="text-sm text-muted-foreground">
            Higher gas price, confirmed within 10 seconds.
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <RadioGroupItem value="instant" id="instant" className="mt-0.5" />
        <div className="grid gap-0.5">
          <label
            htmlFor="instant"
            className="text-sm font-medium leading-none"
          >
            Instant
          </label>
          <p className="text-sm text-muted-foreground">
            Maximum gas price, near-instant confirmation.
          </p>
        </div>
      </div>
    </RadioGroup>
  ),
};

export const Disabled: Story = {
  render: () => (
    <RadioGroup defaultValue="enabled" disabled>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="enabled" id="d-enabled" />
        <label
          htmlFor="d-enabled"
          className="text-sm font-medium leading-none opacity-50"
        >
          Option A
        </label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="disabled" id="d-disabled" />
        <label
          htmlFor="d-disabled"
          className="text-sm font-medium leading-none opacity-50"
        >
          Option B
        </label>
      </div>
    </RadioGroup>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <RadioGroup defaultValue="24h" className="flex gap-4">
      <div className="flex items-center gap-2">
        <RadioGroupItem value="1h" id="h-1h" />
        <label htmlFor="h-1h" className="text-sm leading-none">
          1H
        </label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="24h" id="h-24h" />
        <label htmlFor="h-24h" className="text-sm leading-none">
          24H
        </label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="7d" id="h-7d" />
        <label htmlFor="h-7d" className="text-sm leading-none">
          7D
        </label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="30d" id="h-30d" />
        <label htmlFor="h-30d" className="text-sm leading-none">
          30D
        </label>
      </div>
    </RadioGroup>
  ),
};
