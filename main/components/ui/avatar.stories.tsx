import type { Meta, StoryObj } from "@storybook/react";
import { Avatar, AvatarImage, AvatarFallback } from "./avatar";

const meta: Meta<typeof Avatar> = {
  title: "Components/Avatar",
  component: Avatar,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const Default: Story = {
  render: () => (
    <Avatar>
      <AvatarImage
        src="https://github.com/shadcn.png"
        alt="User avatar"
      />
      <AvatarFallback>张</AvatarFallback>
    </Avatar>
  ),
};

export const Fallback: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="/nonexistent.png" alt="Unknown user" />
      <AvatarFallback>U</AvatarFallback>
    </Avatar>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar className="h-6 w-6">
        <AvatarFallback className="text-xs">张</AvatarFallback>
      </Avatar>
      <Avatar className="h-8 w-8">
        <AvatarFallback className="text-sm">李</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>王</AvatarFallback>
      </Avatar>
      <Avatar className="size-12">
        <AvatarFallback className="text-lg">赵</AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const WithName: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar className="h-8 w-8">
        <AvatarImage src="https://github.com/shadcn.png" alt="张三" />
        <AvatarFallback>张</AvatarFallback>
      </Avatar>
      <div>
        <p className="text-sm font-medium">张三</p>
        <p className="text-xs text-muted-foreground">RESEARCHER</p>
      </div>
    </div>
  ),
};
