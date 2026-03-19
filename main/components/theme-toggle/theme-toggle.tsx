'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

const themes = ['light', 'dark', 'system'] as const;

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="h-8 w-[88px] rounded-full bg-secondary" />
    );
  }

  const currentIndex = themes.indexOf((theme as typeof themes[number]) ?? 'system');

  const handleClick = () => {
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const Icon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <button
      onClick={handleClick}
      className={cn(
        "relative inline-flex h-8 w-[88px] items-center rounded-full border border-border bg-secondary px-1 transition-colors",
        "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
      aria-label={`Current theme: ${theme}. Click to switch.`}
    >
      <motion.div
        className="absolute h-6 w-6 rounded-full bg-background shadow-sm"
        animate={{
          x: currentIndex === 0 ? 2 : currentIndex === 1 ? 30 : 56,
        }}
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 30,
        }}
      />
      <div className="relative z-10 flex w-full justify-between px-0.5">
        <span className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full transition-colors",
          theme === 'light' ? 'text-foreground' : 'text-muted-foreground'
        )}>
          <Sun className="h-3.5 w-3.5" />
        </span>
        <span className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full transition-colors",
          theme === 'dark' ? 'text-foreground' : 'text-muted-foreground'
        )}>
          <Moon className="h-3.5 w-3.5" />
        </span>
        <span className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full transition-colors",
          theme === 'system' ? 'text-foreground' : 'text-muted-foreground'
        )}>
          <Monitor className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  );
}
