import type { Meta, StoryObj } from "@storybook/react";
import { Switch } from "./switch";
import { Globe } from "lucide-react";

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
        公开此分类
      </label>
    </div>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Switch id="public-switch" defaultChecked />
      <Globe className="h-4 w-4 text-success" />
      <label htmlFor="public-switch" className="text-sm font-medium">
        Public
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
      <h4 className="text-sm font-medium">分类设置</h4>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">公开</p>
          <p className="text-xs text-muted-foreground">
            Allow all users to browse this corpus
          </p>
        </div>
        <Switch defaultChecked />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">置顶</p>
          <p className="text-xs text-muted-foreground">
            Pin this corpus to the top of the library
          </p>
        </div>
        <Switch />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">允许编辑</p>
          <p className="text-xs text-muted-foreground">
            Let taggers modify entries in this corpus
          </p>
        </div>
        <Switch defaultChecked />
      </div>
    </div>
  ),
};
