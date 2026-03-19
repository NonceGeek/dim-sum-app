# Phase 2 Implementation Plan — Brand + Token + Theme + Page Optimization

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refine brand colors to indigo, eliminate all hardcoded color classes across the app, unlock light/dark/system theme switching with a new Pill Toggle component, and optimize page experience.

**Architecture:** Replace all hardcoded Tailwind gray/color classes with semantic token classes (`bg-card`, `text-foreground`, `border-border`, etc.) that resolve through the 3-layer token system. Unlock `next-themes` by removing `forcedTheme`. Build a Pill Toggle using framer-motion for smooth light/dark switching.

**Tech Stack:** Next.js 16, Tailwind CSS v4, next-themes, framer-motion (motion/react), OKLCH colors, CVA

**Design Doc:** `docs/plans/2026-03-19-phase2-brand-theme-optimization-design.md`

---

## Task 1: Refine Brand Colors to Indigo

**Files:**
- Modify: `main/styles/tokens/primitives.css`

**Step 1: Update brand hue from 260 → 250 and adjust chroma**

In `main/styles/tokens/primitives.css`, replace the Brand section (lines 23-37) with:

```css
  /* --------------------------------------------------------------------------
   * Brand (hue 250 — indigo)
   * Smooth lightness ramp from near-white (50) to near-black (950)
   * ------------------------------------------------------------------------ */
  --ds-color-brand-50:  oklch(0.97 0.01 250);
  --ds-color-brand-100: oklch(0.93 0.03 250);
  --ds-color-brand-200: oklch(0.87 0.07 250);
  --ds-color-brand-300: oklch(0.78 0.13 250);
  --ds-color-brand-400: oklch(0.68 0.19 250);
  --ds-color-brand-500: oklch(0.58 0.22 250);
  --ds-color-brand-600: oklch(0.50 0.21 250);
  --ds-color-brand-700: oklch(0.42 0.17 250);
  --ds-color-brand-800: oklch(0.35 0.12 250);
  --ds-color-brand-900: oklch(0.28 0.09 250);
  --ds-color-brand-950: oklch(0.22 0.06 250);
```

**Step 2: Update neutral hue to match**

Replace the Neutral section (lines 39-54) — change hue from 260 to 250:

```css
  /* --------------------------------------------------------------------------
   * Neutral (hue 250, very low chroma ~0.005 — tinted gray)
   * Full range from white (0) through near-black (950)
   * ------------------------------------------------------------------------ */
  --ds-color-neutral-0:   oklch(1.00 0.000 250);
  --ds-color-neutral-50:  oklch(0.98 0.003 250);
  --ds-color-neutral-100: oklch(0.94 0.005 250);
  --ds-color-neutral-200: oklch(0.88 0.005 250);
  --ds-color-neutral-300: oklch(0.80 0.005 250);
  --ds-color-neutral-400: oklch(0.70 0.005 250);
  --ds-color-neutral-500: oklch(0.58 0.005 250);
  --ds-color-neutral-600: oklch(0.48 0.005 250);
  --ds-color-neutral-700: oklch(0.39 0.005 250);
  --ds-color-neutral-800: oklch(0.30 0.005 250);
  --ds-color-neutral-900: oklch(0.22 0.005 250);
  --ds-color-neutral-950: oklch(0.15 0.005 250);
```

**Step 3: Update shadow hue references**

In the shadows section, replace all `oklch(0.22 0.005 260` with `oklch(0.22 0.005 250` (6 occurrences in lines 176-196).

**Step 4: Verify build**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm build
```

Expected: Build succeeds.

**Step 5: Verify in Storybook**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm storybook
```

Check Foundations > Colors — brand colors should shift slightly bluer.

**Step 6: Commit**

```bash
git add main/styles/tokens/primitives.css
git commit -m "feat: refine brand colors from violet (260) to indigo (250)"
```

---

## Task 2: Fix Component Token Hardcoding

**Files:**
- Modify: `main/components/ui/button.tsx:24`
- Modify: `main/components/ui/input.tsx:11`
- Modify: `main/app/globals.css:85-87`

**Step 1: Fix button.tsx**

In `main/components/ui/button.tsx`, line 24, replace the `common` variant:

Old:
```
"bg-background text-primary-foreground shadow-xs hover:bg-background/20 dark:hover:bg-gray-800/50 border border-gray-300 dark:border-gray-500",
```

New:
```
"bg-background text-primary-foreground shadow-xs hover:bg-accent border border-border",
```

**Step 2: Fix input.tsx**

In `main/components/ui/input.tsx`, line 11, replace:

Old:
```
"file:text-foreground dark:file:text-gray-300 placeholder:text-muted-foreground
```

New:
```
"file:text-foreground placeholder:text-muted-foreground
```

(Remove `dark:file:text-gray-300` — `file:text-foreground` already handles both modes via token.)

**Step 3: Fix globals.css**

In `main/app/globals.css`, replace lines 85-87:

Old:
```css
  .gray_text_sm {
    @apply text-sm text-gray-600 dark:text-gray-400;
  }
```

New:
```css
  .gray_text_sm {
    @apply text-sm text-muted-foreground;
  }
```

**Step 4: Verify build**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm build
```

**Step 5: Commit**

```bash
git add main/components/ui/button.tsx main/components/ui/input.tsx main/app/globals.css
git commit -m "fix: replace hardcoded gray classes with semantic tokens in button, input, globals"
```

---

## Task 3: Unlock Theme Switching + Pill Toggle

**Files:**
- Modify: `main/app/providers.tsx`
- Rewrite: `main/components/theme-toggle/theme-toggle.tsx`
- Create: `main/components/theme-toggle/theme-toggle.stories.tsx`

**Step 1: Unlock theme in providers.tsx**

In `main/app/providers.tsx`, replace lines 15-21:

Old:
```tsx
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              forcedTheme="dark"
              // enableSystem
              disableTransitionOnChange
            >
```

New:
```tsx
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
```

**Step 2: Rewrite ThemeToggle as Pill Toggle**

Replace `main/components/theme-toggle/theme-toggle.tsx` entirely:

```tsx
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
```

**Step 3: Write ThemeToggle story**

Create `main/components/theme-toggle/theme-toggle.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { ThemeToggle } from "./theme-toggle";

const meta: Meta<typeof ThemeToggle> = {
  title: "Components/ThemeToggle",
  component: ThemeToggle,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="flex items-center gap-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ThemeToggle>;

export const Default: Story = {};
```

**Step 4: Verify Storybook**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm storybook
```

Toggle through light → dark → system in the ThemeToggle story. Verify pill slides smoothly.

**Step 5: Verify dev server**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm dev
```

Open http://localhost:3000. The theme toggle should now cycle through light/dark/system. Light mode may look broken — that's expected, we'll fix pages in subsequent tasks.

**Step 6: Commit**

```bash
git add main/app/providers.tsx main/components/theme-toggle/
git commit -m "feat: unlock theme switching with Pill Toggle (light/dark/system)"
```

---

## Task 4: Tokenize Home Page

**Files:**
- Modify: `main/app/(home)/page.tsx`

**Step 1: Replace all hardcoded colors**

Apply these replacements throughout `main/app/(home)/page.tsx`:

| Line(s) | Old | New |
|---------|-----|-----|
| 234 | `from-purple-500 via-indigo-500 to-blue-500` | `from-primary via-primary/80 to-primary/60` |
| 274 | `text-gray-400` | `text-muted-foreground` |
| 354 | `bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white` | `bg-primary hover:bg-primary/90 text-primary-foreground` |
| 383,396,407,418,429,442,665,678,691,702 | `hover:bg-gray-50 dark:hover:bg-gray-800` | `hover:bg-accent` |
| 387,400,411,422,433,446,618,647,669,682,695,706 | `text-gray-900 dark:text-gray-100` | `text-foreground` |
| 390,403,414,425,437,449,621,650,672,685,698,710 | `text-gray-600 dark:text-gray-400` | `text-muted-foreground` |
| 454 | `text-gray-500` | `text-muted-foreground` |
| 551 | `text-gray-500` | `text-muted-foreground` |
| 588 | `text-gray-900 dark:text-gray-500` | `text-muted-foreground` |
| 610 | `hover:bg-primary/5 dark:hover:bg-gray-800` | `hover:bg-accent` |
| 643 | `bg-gray-100 dark:bg-gray-800` | `bg-muted` |
| 644 | `text-gray-500 dark:text-gray-400` | `text-muted-foreground` |

**Step 2: Verify build**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm build
```

**Step 3: Verify visually in both themes**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm dev
```

Check home page in light and dark mode. Cards, search bar, gradient text, pagination should look correct in both.

**Step 4: Commit**

```bash
git add main/app/'(home)'/page.tsx
git commit -m "refactor: tokenize home page — replace all hardcoded gray/purple classes"
```

---

## Task 5: Tokenize Account Pages

**Files:**
- Modify: `main/app/(account)/account/my-record/page.tsx`
- Modify: `main/app/(account)/account/data-annotation/page.tsx`

**Step 1: Tokenize my-record page**

Apply these replacements in `main/app/(account)/account/my-record/page.tsx`:

| Line | Old | New |
|------|-----|-----|
| 221 | `text-gray-500` (inactive tab) | `text-muted-foreground` |
| 242 | `bg-gray-800` (search container) | `bg-secondary` |
| 243 | `text-gray-400` (search icon) | `text-muted-foreground` |
| 248 | `bg-gray-800 border-none text-white` (search input) | `bg-secondary border-none text-foreground` |
| 259 | `bg-gray-700` (skeleton) | `bg-muted` |
| 268 | `bg-gray-800 text-gray-300` (inactive pill) | `bg-secondary text-muted-foreground` |
| 267 | `text-white` (active pill) | `text-primary-foreground` |
| 282 | `bg-gray-800 border-none text-white` (skeleton cards) | `bg-card border-none text-foreground` |
| 308 | `bg-gray-800 border-none text-white` (item cards) | `bg-card border-none text-foreground` |
| 320,333 | `text-gray-400` | `text-muted-foreground` |
| 347,351,355 | `text-gray-300` (audio controls) | `text-muted-foreground` |
| 391 | `text-gray-400` (time display) | `text-muted-foreground` |
| 397 | `text-gray-500` (date) | `text-muted-foreground` |

**Step 2: Tokenize data-annotation page**

Apply these replacements in `main/app/(account)/account/data-annotation/page.tsx`:

Replace the `buttonClass` constant (line 23-24):

Old:
```ts
const buttonClass =
  "rounded-full border border-gray-400 px-6 py-2 text-white bg-transparent hover:bg-gray-700 transition-colors duration-150 mr-2";
```

New:
```ts
const buttonClass =
  "rounded-full border border-border px-6 py-2 text-foreground bg-transparent hover:bg-accent transition-colors duration-150 mr-2";
```

Other replacements:

| Line | Old | New |
|------|-----|-----|
| 140 | `text-gray-300 hover:text-blue-400` | `text-muted-foreground hover:text-info` |
| 149 | `text-gray-300 hover:text-green-400` | `text-muted-foreground hover:text-success` |
| 190 | `border-gray-600` | `border-border` |
| 191 | `text-gray-400` | `text-muted-foreground` |
| 198 | `text-white placeholder-gray-400` | `text-foreground placeholder-muted-foreground` |
| 224 | `text-gray-400` | `text-muted-foreground` |
| 283 | `text-gray-400` | `text-muted-foreground` |
| 305 | `bg-transparent text-white text-base border border-white/20` | `bg-transparent text-foreground text-base border border-border` |
| 307 | `bg-[#23242a]` | `bg-muted` |
| 308,309,310 | `border-gray-600 text-white` | `border-border text-foreground` |
| 318,322,325,349,350,351 | `border-gray-600` | `border-border` |
| 339 | `text-gray-500` | `text-muted-foreground` |
| 350 | `text-gray-500` | `text-muted-foreground` |
| 401 | `text-gray-400` | `text-muted-foreground` |
| 405 | `border-gray-600 text-white` | `border-border text-foreground` |

**Step 3: Verify build**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm build
```

**Step 4: Commit**

```bash
git add main/app/'(account)'/
git commit -m "refactor: tokenize account pages (my-record, data-annotation)"
```

---

## Task 6: Tokenize Admin Layout

**Files:**
- Modify: `main/app/admin/layout.tsx`

**Step 1: Replace all hardcoded colors**

Apply these replacements in `main/app/admin/layout.tsx`:

| Line | Old | New |
|------|-----|-----|
| 100 | `bg-gray-900` | `bg-background` |
| 104 | `bg-gray-800 border-r border-gray-700` | `bg-card border-r border-border` |
| 108 | `border-b border-gray-700` | `border-b border-border` |
| 110 | `text-purple-400` | `text-primary` |
| 111 | `text-white` | `text-foreground` |
| 118 | `text-gray-400 hover:text-white hover:bg-gray-700` | `text-muted-foreground hover:text-foreground hover:bg-accent` |
| 135 | `bg-gray-700 text-white` | `bg-accent text-foreground` |
| 136 | `text-gray-300 hover:bg-gray-700 hover:text-white` | `text-muted-foreground hover:bg-accent hover:text-foreground` |
| 147 | `border-t border-gray-700` | `border-t border-border` |
| 149 | `bg-purple-600` | `bg-primary` |
| 150 | `text-white` | `text-primary-foreground` |
| 155 | `text-white` | `text-foreground` |
| 158 | `text-gray-400` | `text-muted-foreground` |
| 164 | `bg-gray-700` | `bg-border` |
| 168 | `text-gray-300 hover:text-white hover:bg-gray-700` | `text-muted-foreground hover:text-foreground hover:bg-accent` |
| 188 | `bg-gray-800 border-b border-gray-700` | `bg-card border-b border-border` |
| 194 | `text-gray-400 hover:text-white hover:bg-gray-700` | `text-muted-foreground hover:text-foreground hover:bg-accent` |
| 199 | `text-white` | `text-foreground` |
| 205 | `text-gray-400` | `text-muted-foreground` |
| 213 | `bg-gray-900` | `bg-background` |

**Step 2: Verify build**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm build
```

**Step 3: Commit**

```bash
git add main/app/admin/layout.tsx
git commit -m "refactor: tokenize admin layout — replace 20+ hardcoded gray classes"
```

---

## Task 7: Tokenize Admin Dashboard

**Files:**
- Modify: `main/app/admin/page.tsx`

**Step 1: Replace all hardcoded colors**

Apply these replacements in `main/app/admin/page.tsx`:

| Line | Old | New |
|------|-----|-----|
| 110 | `bg-gray-800 border-gray-700` | `bg-card border-border` |
| 112,113,116,117 | `bg-gray-600` | `bg-muted` |
| 130 | `text-white` | `text-foreground` |
| 133 | `text-gray-400` | `text-muted-foreground` |
| 145 | `bg-gray-800 border-gray-700 hover:bg-gray-750` | `bg-card border-border hover:bg-accent` |
| 149 | `text-gray-200` | `text-card-foreground` |
| 152 | `text-gray-400` | `text-muted-foreground` |
| 155 | `text-white` | `text-foreground` |
| 158 | `text-gray-400` | `text-muted-foreground` |
| 168 | `text-white` | `text-foreground` |
| 175 | `bg-gray-800 border-gray-700 hover:bg-gray-750` | `bg-card border-border hover:bg-accent` |
| 179 | `text-purple-400` | `text-primary` |
| 180 | `text-white` | `text-foreground` |
| 184 | `text-gray-400` | `text-muted-foreground` |
| 192 | `bg-purple-600 hover:bg-purple-700` | `bg-primary hover:bg-primary/90` |

**Step 2: Verify build**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm build
```

**Step 3: Commit**

```bash
git add main/app/admin/page.tsx
git commit -m "refactor: tokenize admin dashboard page"
```

---

## Task 8: Tokenize Admin Users Page

**Files:**
- Modify: `main/app/admin/users/page.tsx`

**Step 1: Replace getRoleBadgeColor function**

Replace the `getRoleBadgeColor` function (lines 111-124):

```ts
  const getRoleBadgeColor = (role: Role) => {
    switch (role) {
      case "LEARNER":
        return "bg-info text-info-foreground";
      case "TAGGER_PARTNER":
        return "bg-success text-success-foreground";
      case "TAGGER_OUTSOURCING":
        return "bg-warning text-warning-foreground";
      case "RESEARCHER":
        return "bg-primary text-primary-foreground";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };
```

**Step 2: Replace all hardcoded classes**

Apply these replacements throughout the file:

- All `text-white` → `text-foreground`
- All `text-gray-300` → `text-muted-foreground`
- All `text-gray-400` → `text-muted-foreground`
- All `bg-gray-800 border-gray-700` → `bg-card border-border`
- All `bg-gray-700 border-gray-600 text-white` → `bg-secondary border-border text-foreground`
- All `border-gray-700` (on TableRow) → `border-border`
- `bg-gray-700 flex items-center justify-center` (avatar) → `bg-muted flex items-center justify-center`
- `bg-purple-600 hover:bg-purple-700` → `bg-primary hover:bg-primary/90`
- `text-yellow-400` (shield icon) → `text-warning`

Also update the Badge usage (line 240) — remove `text-white` since colors are now in the function:
```tsx
<Badge className={getRoleBadgeColor(user.role)}>
```

**Step 3: Verify build**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm build
```

**Step 4: Commit**

```bash
git add main/app/admin/users/page.tsx
git commit -m "refactor: tokenize admin users page"
```

---

## Task 9: Tokenize Admin Categories Page

**Files:**
- Modify: `main/app/admin/categories/page.tsx`

**Step 1: Replace all hardcoded colors**

Same pattern as Task 8:

- All `text-white` → `text-foreground`
- All `text-gray-300` → `text-muted-foreground`
- All `text-gray-400` → `text-muted-foreground`
- All `bg-gray-800 border-gray-700` → `bg-card border-border`
- All `bg-gray-700 border-gray-600 text-white` → `bg-secondary border-border text-foreground`
- All `border-gray-700` (on TableRow) → `border-border`
- `bg-purple-600 hover:bg-purple-700` → `bg-primary hover:bg-primary/90`
- `bg-yellow-500` → `bg-warning text-warning-foreground`
- `bg-green-500` → `bg-success text-success-foreground`
- `text-green-400` → `text-success`
- `text-yellow-400` → `text-warning`

**Step 2: Verify build, commit**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm build
git add main/app/admin/categories/page.tsx
git commit -m "refactor: tokenize admin categories page"
```

---

## Task 10: Tokenize Admin Corpus Page

**Files:**
- Modify: `main/app/admin/corpus/page.tsx`

**Step 1: Replace all hardcoded colors**

Same pattern:

- All `text-white` → `text-foreground`
- All `text-gray-300` → `text-muted-foreground`
- All `text-gray-400` → `text-muted-foreground`
- All `text-gray-500` → `text-muted-foreground`
- All `bg-gray-800 border-gray-700` → `bg-card border-border`
- All `bg-gray-700 border-gray-600 text-white` → `bg-secondary border-border text-foreground`
- All `border-gray-700` (on TableRow) → `border-border`
- `bg-purple-600 hover:bg-purple-700` → `bg-primary hover:bg-primary/90`
- `bg-blue-500 text-white` (category badge) → `bg-info text-info-foreground`

**Step 2: Verify build, commit**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm build
git add main/app/admin/corpus/page.tsx
git commit -m "refactor: tokenize admin corpus page"
```

---

## Task 11: Tokenize Admin Audit Logs Page

**Files:**
- Modify: `main/app/admin/audit-logs/page.tsx`

**Step 1: Replace getActionBadgeColor function**

```ts
  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case "GRANT":
        return "bg-success text-success-foreground";
      case "REVOKE":
        return "bg-error text-error-foreground";
      case "MODIFY":
        return "bg-info text-info-foreground";
      case "ROLE_CHANGE":
        return "bg-primary text-primary-foreground";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };
```

**Step 2: Replace all hardcoded classes**

Same pattern as previous admin pages:

- All `text-white` → `text-foreground`
- All `text-gray-300` → `text-muted-foreground`
- All `text-gray-400` → `text-muted-foreground`
- All `bg-gray-800 border-gray-700` → `bg-card border-border`
- All `bg-gray-700 border-gray-600 text-white` → `bg-secondary border-border text-foreground`
- All `border-gray-700` (on TableRow) → `border-border`
- `bg-gray-700 flex items-center justify-center` (avatar circles) → `bg-muted flex items-center justify-center`
- `bg-purple-600 hover:bg-purple-700` → `bg-primary hover:bg-primary/90`

**Step 3: Verify build, commit**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm build
git add main/app/admin/audit-logs/page.tsx
git commit -m "refactor: tokenize admin audit logs page"
```

---

## Task 12: Tokenize Admin Permissions Page

**Files:**
- Modify: `main/app/admin/permissions/page.tsx`

**Step 1: Replace getPermissionBadgeColor function**

```ts
  const getPermissionBadgeColor = (permission: string) => {
    switch (permission) {
      case "FULL":
        return "bg-error text-error-foreground";
      case "CREATE":
        return "bg-primary text-primary-foreground";
      case "WRITE":
        return "bg-info text-info-foreground";
      case "READ":
        return "bg-success text-success-foreground";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };
```

**Step 2: Replace all hardcoded classes**

This is the largest page. Apply these replacements:

- All `text-white` → `text-foreground`
- All `text-gray-300` → `text-muted-foreground`
- All `text-gray-400` → `text-muted-foreground`
- All `bg-gray-800 border-gray-700` (Card) → `bg-card border-border`
- All `bg-gray-700 border-gray-600 text-white` → `bg-secondary border-border text-foreground`
- All `bg-gray-700 border-gray-600` → `bg-secondary border-border`
- All `border-gray-700` (on TableRow) → `border-border`
- All `hover:bg-gray-600` → `hover:bg-accent`
- All `hover:bg-gray-700` → `hover:bg-accent`
- All `bg-gray-700 text-gray-200 hover:bg-gray-600` (Badges) → `bg-secondary text-secondary-foreground hover:bg-accent`
- `bg-purple-600 hover:bg-purple-700` → `bg-primary hover:bg-primary/90`
- `bg-purple-900/30 border-purple-700` → `bg-primary/10 border-primary/30`
- `text-purple-400` → `text-primary`
- `bg-purple-600` → `bg-primary`
- `bg-gray-600 border-gray-500 text-white` → `bg-muted border-border text-foreground`
- `bg-gray-700 rounded border border-gray-600` → `bg-secondary rounded border border-border`
- `bg-blue-500` (permission badge inline) → `bg-info`
- `bg-red-600 hover:bg-red-700 text-white` → `bg-destructive hover:bg-destructive/90 text-destructive-foreground`
- `hover:bg-gray-600 hover:text-white` → `hover:bg-accent hover:text-foreground`

For Dialog/AlertDialog components:
- `bg-gray-800 border-gray-700` → `bg-card border-border`
- `bg-gray-700 border-gray-600 text-white hover:bg-gray-600` → `bg-secondary border-border text-foreground hover:bg-accent`

**Step 3: Verify build, commit**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm build
git add main/app/admin/permissions/page.tsx
git commit -m "refactor: tokenize admin permissions page"
```

---

## Task 13: Tokenize Admin Rules & Settings Pages

**Files:**
- Modify: `main/app/admin/rules/page.tsx`
- Modify: `main/app/admin/settings/page.tsx`

**Step 1: Tokenize rules page**

Apply replacements in `main/app/admin/rules/page.tsx`:

- `text-white` (headings) → `text-foreground`
- `bg-gray-900 border-gray-800` (Cards) → `bg-card border-border`
- `bg-gray-950 border-gray-800` (Inputs/Textareas) → `bg-background border-border`
- `border-gray-800` (borders, table) → `border-border`
- `bg-gray-950` (agent cards) → `bg-background`

**Step 2: Tokenize settings page**

Apply replacements in `main/app/admin/settings/page.tsx`:

- `text-white` → `text-foreground`
- `text-gray-400` → `text-muted-foreground`
- `bg-gray-800 border-gray-700` → `bg-card border-border`
- `text-gray-300` → `text-muted-foreground`

**Step 3: Verify build, commit**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm build
git add main/app/admin/rules/page.tsx main/app/admin/settings/page.tsx
git commit -m "refactor: tokenize admin rules and settings pages"
```

---

## Task 14: Light Mode Visual Verification & Fixes

**Files:**
- Potentially modify: any file with visual issues in light mode

**Step 1: Start dev server**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm dev
```

**Step 2: Visual check in light mode**

Open http://localhost:3000 and switch to light mode. Check each area:

1. **Home page**: Search bar, example cards, gradient title, pagination
2. **Library page**: Card layouts, tag pills
3. **App Store page**: App cards
4. **Account > Profile**: Cards, badges, buttons
5. **Account > My Record**: Tabs, search, content cards, audio player
6. **Account > Data Annotation**: Table borders, action links, pagination
7. **Admin (all pages)**: Sidebar, tables, forms, badges, dialogs

**Step 3: Fix any issues found**

Common issues to look for:
- Insufficient contrast (text-muted-foreground too light on bg-background)
- Invisible borders (border-border too subtle)
- Incorrect foreground on colored badges
- Background gradients that don't work in light mode

**Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix: light mode visual adjustments after tokenization"
```

---

## Task 15: Final Build Verification

**Step 1: Full build**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm build
```

Expected: Build succeeds with no errors.

**Step 2: Storybook build**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm build-storybook
```

Expected: Storybook builds successfully.

**Step 3: Verify Storybook stories in both themes**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm storybook
```

Check Colors, Typography, Button, ThemeToggle stories in both light and dark.

**Step 4: Commit (if any fixes needed)**

---

## Summary: Execution Order

| Task | Description | Depends On |
|------|-------------|-----------|
| 1 | Brand color refinement (indigo) | — |
| 2 | Fix button/input/globals hardcoding | — |
| 3 | Theme switching + Pill Toggle | — |
| 4 | Home page tokenization | 2 |
| 5 | Account pages tokenization | 2 |
| 6 | Admin layout tokenization | 2 |
| 7 | Admin dashboard tokenization | 6 |
| 8 | Admin users tokenization | 6 |
| 9 | Admin categories tokenization | 6 |
| 10 | Admin corpus tokenization | 6 |
| 11 | Admin audit logs tokenization | 6 |
| 12 | Admin permissions tokenization | 6 |
| 13 | Admin rules + settings tokenization | 6 |
| 14 | Light mode visual verification | 1-13 |
| 15 | Final build verification | 14 |

Tasks 1, 2, 3 can run in parallel.
Tasks 4-13 depend on Task 2 (component fixes).
Tasks 7-13 depend on Task 6 (admin layout).
Task 14 depends on all tokenization tasks.
