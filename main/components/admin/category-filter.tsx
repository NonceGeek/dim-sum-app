"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface PermissionCategory {
  id?: number;
  name: string;
  nickname: string | null;
}
export const categoryLabel = (category: PermissionCategory) =>
  category.nickname?.trim() || category.name;
export const categoryIdentifier = (category: PermissionCategory) =>
  category.id == null ? category.name : `#${category.id}`;
export function duplicateCategoryLabels(categories: PermissionCategory[]) {
  const counts = new Map<string, number>();
  for (const category of categories) {
    const label = categoryLabel(category);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return new Set(
    [...counts].filter(([, count]) => count > 1).map(([label]) => label),
  );
}

export function CategoryFilter({
  categories,
  value,
  onChange,
  allLabel,
  searchLabel,
  emptyLabel,
}: {
  categories: PermissionCategory[];
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  searchLabel: string;
  emptyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = categories.find((category) => category.name === value);
  const duplicates = duplicateCategoryLabels(categories);
  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={searchLabel}
          title={
            selected
              ? `${categoryLabel(selected)} · ${categoryIdentifier(selected)}`
              : allLabel
          }
          className="w-48 justify-between gap-2 bg-secondary border-border text-foreground"
        >
          <span className="truncate">
            {selected ? categoryLabel(selected) : value || allLabel}
          </span>
          {selected && duplicates.has(categoryLabel(selected)) && (
            <span className="shrink-0 text-xs">
              {categoryIdentifier(selected)}
            </span>
          )}
          <ChevronDown
            className={cn(
              "size-4 shrink-0 transition-transform motion-reduce:transition-none",
              open && "rotate-180",
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[360px] max-w-[calc(100vw-2rem)] p-0"
      >
        <Command>
          <CommandInput placeholder={searchLabel} aria-label={searchLabel} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all-categories"
                keywords={[allLabel]}
                onSelect={() => choose("")}
              >
                <span className="flex-1">{allLabel}</span>
                <Check
                  className={cn("size-4", value ? "invisible" : "opacity-100")}
                />
              </CommandItem>
              {categories.map((category) => (
                <CommandItem
                  key={category.name}
                  value={`category:${category.name}`}
                  keywords={[
                    categoryLabel(category),
                    categoryIdentifier(category),
                    String(category.id ?? ""),
                  ]}
                  onSelect={() => choose(category.name)}
                  className="items-start gap-2"
                >
                  <span className="min-w-0 flex-1 break-words">
                    <span>{categoryLabel(category)}</span>
                    {duplicates.has(categoryLabel(category)) && (
                      <span className="mt-0.5 block break-all text-xs text-muted-foreground">
                        {categoryIdentifier(category)}
                      </span>
                    )}
                  </span>
                  <Check
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      value === category.name ? "opacity-100" : "invisible",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
