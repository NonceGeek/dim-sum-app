import type { Meta, StoryObj } from "@storybook/react";
import { Popover, PopoverTrigger, PopoverContent } from "./popover";
import { Button } from "./button";
import { Input } from "./input";
import { Checkbox } from "./checkbox";

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
        <Button variant="outline">选择标签</Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0">
        <div className="p-3 border-b border-border">
          <Input placeholder="搜索标签..." className="h-8" />
        </div>
        <div className="p-2 space-y-1">
          {["粤音", "释义", "例词", "粤剧", "口语"].map((tag) => (
            <div key={tag} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer">
              <Checkbox id={tag} />
              <label htmlFor={tag} className="text-sm cursor-pointer">
                {tag}
              </label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  ),
};

export const WithInfo: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <span className="text-sm">Editable Level</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            ?
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <p className="text-sm">
            Controls who can edit corpus entries. Level 0: not editable.
            Level 1: taggers only. Level 2: all logged-in users.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  ),
};
