import type { Meta, StoryObj } from "@storybook/react";
import { Switch } from "./switch";

const meta: Meta<typeof Switch> = {
  title: "Components/Switch",
  component: Switch,
  tags: ["autodocs"],
  argTypes: {
    checked: { control: "boolean" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Switch>;

export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Switch id="default-switch" />
      <label htmlFor="default-switch" className="text-sm font-medium">
        Enable notifications
      </label>
    </div>
  ),
};

export const Checked: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Switch id="checked-switch" defaultChecked />
      <label htmlFor="checked-switch" className="text-sm font-medium">
        Dark mode
      </label>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <Switch id="disabled-off" disabled />
        <label
          htmlFor="disabled-off"
          className="text-sm font-medium opacity-50"
        >
          Disabled (off)
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="disabled-on" disabled defaultChecked />
        <label
          htmlFor="disabled-on"
          className="text-sm font-medium opacity-50"
        >
          Disabled (on)
        </label>
      </div>
    </div>
  ),
};

export const SettingsList: Story = {
  render: () => (
    <div className="w-full max-w-sm space-y-4">
      <h4 className="text-sm font-medium">Explorer Preferences</h4>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Decode Payloads</p>
          <p className="text-xs text-muted-foreground">
            Automatically decode transaction payloads
          </p>
        </div>
        <Switch defaultChecked />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Show USD Values</p>
          <p className="text-xs text-muted-foreground">
            Display approximate USD values for tokens
          </p>
        </div>
        <Switch defaultChecked />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Developer Mode</p>
          <p className="text-xs text-muted-foreground">
            Show raw data and debug information
          </p>
        </div>
        <Switch />
      </div>
    </div>
  ),
};
