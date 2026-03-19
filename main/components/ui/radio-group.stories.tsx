import type { Meta, StoryObj } from "@storybook/react";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import { cn } from "@/lib/utils";

const meta: Meta<typeof RadioGroup> = {
  title: "Components/RadioGroup",
  component: RadioGroup,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof RadioGroup>;

export const Default: Story = {
  render: () => (
    <RadioGroup defaultValue="learner">
      <div className="flex items-center gap-2">
        <RadioGroupItem value="learner" id="learner" />
        <label htmlFor="learner" className="text-sm font-medium leading-none">
          Learner
        </label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="tagger" id="tagger" />
        <label htmlFor="tagger" className="text-sm font-medium leading-none">
          Tagger
        </label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="researcher" id="researcher" />
        <label htmlFor="researcher" className="text-sm font-medium leading-none">
          Researcher
        </label>
      </div>
    </RadioGroup>
  ),
};

export const WithDescriptions: Story = {
  render: () => (
    <RadioGroup defaultValue="read">
      <div className="flex items-start gap-3">
        <RadioGroupItem value="read" id="read" className="mt-0.5" />
        <div className="grid gap-0.5">
          <label htmlFor="read" className="text-sm font-medium leading-none">
            READ
          </label>
          <p className="text-sm text-muted-foreground">
            Can only view public corpus entries.
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <RadioGroupItem value="write" id="write" className="mt-0.5" />
        <div className="grid gap-0.5">
          <label htmlFor="write" className="text-sm font-medium leading-none">
            WRITE
          </label>
          <p className="text-sm text-muted-foreground">
            Can view and edit existing corpus entries.
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <RadioGroupItem value="create" id="create" className="mt-0.5" />
        <div className="grid gap-0.5">
          <label htmlFor="create" className="text-sm font-medium leading-none">
            CREATE
          </label>
          <p className="text-sm text-muted-foreground">
            Can view, edit, and create new corpus entries.
          </p>
        </div>
      </div>
    </RadioGroup>
  ),
};

export const CardStyle: Story = {
  render: () => (
    <RadioGroup
      defaultValue="learner"
      className="flex flex-col items-center space-y-4"
    >
      {["Learner", "Tagger", "Researcher"].map((role) => (
        <div key={role} className="w-full max-w-[200px]">
          <RadioGroupItem
            value={role.toLowerCase()}
            id={`card-${role.toLowerCase()}`}
            className="peer sr-only"
          />
          <label
            htmlFor={`card-${role.toLowerCase()}`}
            className={cn(
              "flex h-10 w-full items-center justify-center rounded-md border-2 border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary"
            )}
          >
            {role}
          </label>
        </div>
      ))}
    </RadioGroup>
  ),
};

export const Disabled: Story = {
  render: () => (
    <RadioGroup defaultValue="learner" disabled>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="learner" id="d-learner" />
        <label
          htmlFor="d-learner"
          className="text-sm font-medium leading-none opacity-50"
        >
          Learner
        </label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="tagger" id="d-tagger" />
        <label
          htmlFor="d-tagger"
          className="text-sm font-medium leading-none opacity-50"
        >
          Tagger
        </label>
      </div>
    </RadioGroup>
  ),
};
