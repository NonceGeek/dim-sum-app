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

type ScopeObject = {
  id: string | number;
  nickname?: string | null;
  name?: string;
  title?: string;
};
const objectName = (object: ScopeObject) =>
  object.nickname || object.name || object.title || String(object.id);
const objectLabel = (object: ScopeObject) =>
  `#${object.id} ${objectName(object)}`;

export function ScopeObjectSelect({
  objects = [],
  value,
  onChange,
  label,
  placeholder,
  searchPlaceholder,
  emptyLabel,
}: {
  objects?: ScopeObject[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = objects.find((object) => String(object.id) === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id="scope-object"
          variant="outline"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          title={selected ? objectLabel(selected) : placeholder}
          className="w-full min-w-0 justify-between gap-2 font-normal"
        >
          <span
            className={cn("truncate", !selected && "text-muted-foreground")}
          >
            {selected ? objectLabel(selected) : placeholder}
          </span>
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
        className="w-[var(--radix-popover-trigger-width)] min-w-64 max-w-[calc(100vw-2rem)] p-0"
      >
        <Command>
          <CommandInput
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {objects.map((object) => (
                <CommandItem
                  key={String(object.id)}
                  value={String(object.id)}
                  keywords={[
                    objectLabel(object),
                    object.name ?? "",
                    object.title ?? "",
                  ]}
                  onSelect={() => {
                    onChange(String(object.id));
                    setOpen(false);
                  }}
                  className="items-start gap-2"
                >
                  <span className="min-w-0 flex-1 break-words">
                    {objectLabel(object)}
                  </span>
                  <Check
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      value === String(object.id) ? "opacity-100" : "invisible",
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
