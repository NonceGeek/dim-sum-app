"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="h-5 w-8" />;

  const isDark = resolvedTheme === "dark";

  return (
    <Switch
      size="md"
      checked={isDark}
      onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
      startIcon={<Sun className="text-white" />}
      endIcon={<Moon />}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    />
  );
}
