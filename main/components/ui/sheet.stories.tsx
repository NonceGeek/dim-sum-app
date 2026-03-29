import type { Meta, StoryObj } from "@storybook/react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./sheet";
import { Button } from "./button";
import { Menu, Home, BookOpen, AppWindow, FileText } from "lucide-react";

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
        <Button variant="ghost" size="icon">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <SheetHeader>
          <SheetTitle>DimSum AI Labs</SheetTitle>
          <SheetDescription>Navigate the platform.</SheetDescription>
        </SheetHeader>
        <nav className="grid gap-1 px-4 mt-4">
          <Button variant="ghost" className="justify-start gap-2">
            <Home className="h-4 w-4" />
            Home
          </Button>
          <Button variant="ghost" className="justify-start gap-2">
            <BookOpen className="h-4 w-4" />
            Library
          </Button>
          <Button variant="ghost" className="justify-start gap-2">
            <AppWindow className="h-4 w-4" />
            App Store
          </Button>
          <Button variant="ghost" className="justify-start gap-2">
            <FileText className="h-4 w-4" />
            Docs
          </Button>
        </nav>
      </SheetContent>
    </Sheet>
  ),
};
