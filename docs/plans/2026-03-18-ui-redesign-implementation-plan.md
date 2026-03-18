# UI Redesign & Design System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish a Design Token system, set up Storybook 10, and refactor dimsum-app's UI components for a brand new visual style.

**Architecture:** Three-layer token system (primitive → semantic → component) consumed by shadcn/ui components via CSS custom properties. Storybook 10 with `@storybook/nextjs-vite` for documentation. Gradual migration — old variable names preserved, components refactored in batches.

**Tech Stack:** Next.js 16, Tailwind CSS v4, Storybook 10, `@storybook/nextjs-vite`, OKLCH colors, CVA, Radix UI

**Design Doc:** `docs/plans/2026-03-18-ui-redesign-design-system.md`

---

## Task 1: Upgrade Next.js 15 → 16

**Files:**
- Modify: `main/package.json`
- Modify: `main/next.config.ts`
- Modify: `main/app/layout.tsx` (if API changes)

**Step 1: Check Next.js 16 migration guide**

Run: `pnpm info next version` to confirm latest v16 version available.

Review the Next.js 16 upgrade guide at https://nextjs.org/docs/app/building-your-application/upgrading

**Step 2: Upgrade Next.js and React**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main
pnpm add next@latest react@latest react-dom@latest
```

Also upgrade eslint-config-next:
```bash
pnpm add -D eslint-config-next@latest
```

**Step 3: Fix any breaking changes**

Check `next.config.ts` — Next.js 16 may change config format. Current config uses:
- `images.remotePatterns` — should be stable
- `webpack` customization for `.md` files — verify still works

Check `app/layout.tsx` — uses `Inter` from `next/font/google`, verify API unchanged.

Check `app/providers.tsx` — uses `next-themes` ThemeProvider, verify compatibility.

**Step 4: Verify build**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main
pnpm build
```

Expected: Build succeeds with no errors.

**Step 5: Verify dev server**

```bash
pnpm dev
```

Open http://localhost:3000, verify pages load correctly.

**Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml next.config.ts
git commit -m "chore: upgrade Next.js 15 → 16"
```

---

## Task 2: Create Primitive Token Layer

**Files:**
- Create: `main/styles/tokens/primitives.css`

**Step 1: Create the styles directory**

```bash
mkdir -p /Users/fun/Documents/GitHub/dimsum-app/main/styles/tokens
```

**Step 2: Write primitive color tokens**

Create `main/styles/tokens/primitives.css` with a full OKLCH color palette. These are raw design values — not used directly by components.

```css
/* ===========================================
   Primitive Tokens — Raw design values
   DO NOT reference these directly in components.
   Use semantic tokens (semantic-light.css / semantic-dark.css) instead.
   =========================================== */

:root {
  /* --- Color Palette --- */

  /* Brand */
  --ds-brand-50:  oklch(0.97 0.02 260);
  --ds-brand-100: oklch(0.93 0.04 260);
  --ds-brand-200: oklch(0.86 0.08 260);
  --ds-brand-300: oklch(0.76 0.12 260);
  --ds-brand-400: oklch(0.65 0.17 260);
  --ds-brand-500: oklch(0.55 0.20 260);
  --ds-brand-600: oklch(0.47 0.20 260);
  --ds-brand-700: oklch(0.40 0.18 260);
  --ds-brand-800: oklch(0.33 0.14 260);
  --ds-brand-900: oklch(0.27 0.10 260);
  --ds-brand-950: oklch(0.20 0.08 260);

  /* Neutral */
  --ds-neutral-0:   oklch(1.00 0 0);
  --ds-neutral-50:  oklch(0.97 0.005 260);
  --ds-neutral-100: oklch(0.93 0.005 260);
  --ds-neutral-200: oklch(0.87 0.005 260);
  --ds-neutral-300: oklch(0.78 0.005 260);
  --ds-neutral-400: oklch(0.64 0.005 260);
  --ds-neutral-500: oklch(0.53 0.005 260);
  --ds-neutral-600: oklch(0.44 0.005 260);
  --ds-neutral-700: oklch(0.37 0.005 260);
  --ds-neutral-800: oklch(0.27 0.005 260);
  --ds-neutral-900: oklch(0.21 0.005 260);
  --ds-neutral-950: oklch(0.14 0.005 260);

  /* Red (Destructive / Error) */
  --ds-red-50:  oklch(0.97 0.02 25);
  --ds-red-100: oklch(0.93 0.05 25);
  --ds-red-200: oklch(0.86 0.10 25);
  --ds-red-300: oklch(0.76 0.16 25);
  --ds-red-400: oklch(0.65 0.20 25);
  --ds-red-500: oklch(0.58 0.22 25);
  --ds-red-600: oklch(0.50 0.20 25);
  --ds-red-700: oklch(0.42 0.17 25);
  --ds-red-800: oklch(0.35 0.13 25);
  --ds-red-900: oklch(0.28 0.10 25);

  /* Green (Success) */
  --ds-green-50:  oklch(0.97 0.02 155);
  --ds-green-100: oklch(0.93 0.05 155);
  --ds-green-200: oklch(0.86 0.10 155);
  --ds-green-300: oklch(0.76 0.14 155);
  --ds-green-400: oklch(0.65 0.17 155);
  --ds-green-500: oklch(0.55 0.17 155);
  --ds-green-600: oklch(0.47 0.15 155);
  --ds-green-700: oklch(0.40 0.13 155);
  --ds-green-800: oklch(0.33 0.10 155);
  --ds-green-900: oklch(0.27 0.08 155);

  /* Amber (Warning) */
  --ds-amber-50:  oklch(0.97 0.02 85);
  --ds-amber-100: oklch(0.93 0.05 85);
  --ds-amber-200: oklch(0.86 0.10 85);
  --ds-amber-300: oklch(0.78 0.14 85);
  --ds-amber-400: oklch(0.72 0.16 85);
  --ds-amber-500: oklch(0.65 0.16 85);
  --ds-amber-600: oklch(0.55 0.14 85);
  --ds-amber-700: oklch(0.47 0.12 85);
  --ds-amber-800: oklch(0.40 0.10 85);
  --ds-amber-900: oklch(0.33 0.08 85);

  /* Blue (Info) */
  --ds-blue-50:  oklch(0.97 0.02 240);
  --ds-blue-100: oklch(0.93 0.04 240);
  --ds-blue-200: oklch(0.86 0.08 240);
  --ds-blue-300: oklch(0.76 0.12 240);
  --ds-blue-400: oklch(0.65 0.16 240);
  --ds-blue-500: oklch(0.55 0.18 240);
  --ds-blue-600: oklch(0.47 0.17 240);
  --ds-blue-700: oklch(0.40 0.15 240);
  --ds-blue-800: oklch(0.33 0.12 240);
  --ds-blue-900: oklch(0.27 0.09 240);

  /* --- Spacing Scale (4px base) --- */
  --ds-space-0:   0px;
  --ds-space-0.5: 2px;
  --ds-space-1:   4px;
  --ds-space-1.5: 6px;
  --ds-space-2:   8px;
  --ds-space-3:   12px;
  --ds-space-4:   16px;
  --ds-space-5:   20px;
  --ds-space-6:   24px;
  --ds-space-8:   32px;
  --ds-space-10:  40px;
  --ds-space-12:  48px;
  --ds-space-16:  64px;
  --ds-space-20:  80px;
  --ds-space-24:  96px;

  /* --- Typography Scale --- */
  --ds-font-size-xs:   0.75rem;   /* 12px */
  --ds-font-size-sm:   0.875rem;  /* 14px */
  --ds-font-size-md:   1rem;      /* 16px */
  --ds-font-size-lg:   1.125rem;  /* 18px */
  --ds-font-size-xl:   1.25rem;   /* 20px */
  --ds-font-size-2xl:  1.5rem;    /* 24px */
  --ds-font-size-3xl:  1.875rem;  /* 30px */
  --ds-font-size-4xl:  2.25rem;   /* 36px */

  --ds-line-height-tight:  1.25;
  --ds-line-height-normal: 1.5;
  --ds-line-height-loose:  1.75;

  --ds-font-weight-normal:   400;
  --ds-font-weight-medium:   500;
  --ds-font-weight-semibold: 600;
  --ds-font-weight-bold:     700;

  /* --- Border Radius Scale --- */
  --ds-radius-none: 0;
  --ds-radius-sm:   4px;
  --ds-radius-md:   6px;
  --ds-radius-lg:   8px;
  --ds-radius-xl:   12px;
  --ds-radius-2xl:  16px;
  --ds-radius-full: 9999px;

  /* --- Shadow Scale --- */
  --ds-shadow-xs:  0 1px 2px oklch(0 0 0 / 0.05);
  --ds-shadow-sm:  0 1px 3px oklch(0 0 0 / 0.10), 0 1px 2px oklch(0 0 0 / 0.06);
  --ds-shadow-md:  0 4px 6px oklch(0 0 0 / 0.10), 0 2px 4px oklch(0 0 0 / 0.06);
  --ds-shadow-lg:  0 10px 15px oklch(0 0 0 / 0.10), 0 4px 6px oklch(0 0 0 / 0.05);
  --ds-shadow-xl:  0 20px 25px oklch(0 0 0 / 0.10), 0 8px 10px oklch(0 0 0 / 0.04);
  --ds-shadow-2xl: 0 25px 50px oklch(0 0 0 / 0.25);

  /* --- Motion --- */
  --ds-duration-fast:    100ms;
  --ds-duration-normal:  200ms;
  --ds-duration-slow:    300ms;
  --ds-duration-slower:  500ms;

  --ds-ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ds-ease-in:      cubic-bezier(0.4, 0, 1, 1);
  --ds-ease-out:     cubic-bezier(0, 0, 0.2, 1);
  --ds-ease-in-out:  cubic-bezier(0.4, 0, 0.2, 1);
  --ds-ease-spring:  cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

**Step 3: Commit**

```bash
git add main/styles/tokens/primitives.css
git commit -m "feat: add primitive design tokens (colors, spacing, typography, radius, shadow, motion)"
```

---

## Task 3: Create Semantic Token Layer

**Files:**
- Create: `main/styles/tokens/semantic-light.css`
- Create: `main/styles/tokens/semantic-dark.css`

**Step 1: Write light mode semantic tokens**

Create `main/styles/tokens/semantic-light.css`. These map primitives to purpose-driven names. The existing shadcn variable names (`--primary`, `--background`, etc.) are preserved for backward compatibility.

```css
/* ===========================================
   Semantic Tokens — Light Mode
   Maps primitive tokens to purpose-driven names.
   Components consume these variables.
   =========================================== */

:root {
  /* --- Surfaces --- */
  --background:          var(--ds-neutral-0);
  --foreground:          var(--ds-neutral-900);
  --card:                var(--ds-neutral-0);
  --card-foreground:     var(--ds-neutral-900);
  --popover:             var(--ds-neutral-0);
  --popover-foreground:  var(--ds-neutral-900);

  /* --- Brand --- */
  --primary:             var(--ds-brand-600);
  --primary-foreground:  var(--ds-neutral-0);
  --secondary:           var(--ds-neutral-100);
  --secondary-foreground: var(--ds-neutral-900);

  /* --- Utility --- */
  --muted:               var(--ds-neutral-100);
  --muted-foreground:    var(--ds-neutral-500);
  --accent:              var(--ds-neutral-100);
  --accent-foreground:   var(--ds-neutral-900);
  --accent-background:   var(--ds-neutral-50);
  --destructive:         var(--ds-red-500);

  /* --- Boundaries --- */
  --border:              var(--ds-neutral-200);
  --input:               var(--ds-neutral-200);
  --ring:                var(--ds-brand-500);

  /* --- Functional Colors --- */
  --success:             var(--ds-green-500);
  --success-foreground:  var(--ds-neutral-0);
  --warning:             var(--ds-amber-500);
  --warning-foreground:  var(--ds-neutral-900);
  --info:                var(--ds-blue-500);
  --info-foreground:     var(--ds-neutral-0);
  --error:               var(--ds-red-500);
  --error-foreground:    var(--ds-neutral-0);

  /* --- Chart --- */
  --chart-1:             var(--ds-brand-500);
  --chart-2:             var(--ds-green-500);
  --chart-3:             var(--ds-amber-500);
  --chart-4:             var(--ds-blue-500);
  --chart-5:             var(--ds-red-400);

  /* --- Sidebar --- */
  --sidebar:                    var(--ds-neutral-0);
  --sidebar-foreground:         var(--ds-neutral-900);
  --sidebar-primary:            var(--ds-brand-600);
  --sidebar-primary-foreground: var(--ds-neutral-0);
  --sidebar-primary-background: var(--ds-neutral-0);
  --sidebar-accent:             var(--ds-neutral-100);
  --sidebar-accent-foreground:  var(--ds-neutral-900);
  --sidebar-accent-background:  var(--ds-neutral-50);
  --sidebar-border:             var(--ds-neutral-200);
  --sidebar-ring:               var(--ds-brand-500);

  /* --- Radius (semantic alias) --- */
  --radius: var(--ds-radius-lg);
}
```

**Step 2: Write dark mode semantic tokens**

Create `main/styles/tokens/semantic-dark.css`:

```css
/* ===========================================
   Semantic Tokens — Dark Mode
   Overrides light mode values under .dark class.
   All values in OKLCH — no hex fallbacks.
   =========================================== */

.dark {
  /* --- Surfaces --- */
  --background:          var(--ds-neutral-950);
  --foreground:          var(--ds-neutral-50);
  --card:                var(--ds-neutral-900);
  --card-foreground:     var(--ds-neutral-50);
  --popover:             var(--ds-neutral-900);
  --popover-foreground:  var(--ds-neutral-50);

  /* --- Brand --- */
  --primary:             var(--ds-brand-400);
  --primary-foreground:  var(--ds-neutral-950);
  --secondary:           var(--ds-neutral-800);
  --secondary-foreground: var(--ds-neutral-50);

  /* --- Utility --- */
  --muted:               var(--ds-neutral-800);
  --muted-foreground:    var(--ds-neutral-400);
  --accent:              var(--ds-neutral-800);
  --accent-foreground:   var(--ds-neutral-50);
  --accent-background:   var(--ds-neutral-800);
  --destructive:         var(--ds-red-400);

  /* --- Boundaries --- */
  --border:              var(--ds-neutral-700);
  --input:               var(--ds-neutral-700);
  --ring:                var(--ds-brand-400);

  /* --- Functional Colors --- */
  --success:             var(--ds-green-400);
  --success-foreground:  var(--ds-neutral-950);
  --warning:             var(--ds-amber-400);
  --warning-foreground:  var(--ds-neutral-950);
  --info:                var(--ds-blue-400);
  --info-foreground:     var(--ds-neutral-950);
  --error:               var(--ds-red-400);
  --error-foreground:    var(--ds-neutral-950);

  /* --- Chart --- */
  --chart-1:             var(--ds-brand-400);
  --chart-2:             var(--ds-green-400);
  --chart-3:             var(--ds-amber-400);
  --chart-4:             var(--ds-blue-400);
  --chart-5:             var(--ds-red-400);

  /* --- Sidebar --- */
  --sidebar:                    var(--ds-neutral-900);
  --sidebar-foreground:         var(--ds-neutral-50);
  --sidebar-primary:            var(--ds-brand-400);
  --sidebar-primary-foreground: var(--ds-neutral-950);
  --sidebar-primary-background: var(--ds-neutral-950);
  --sidebar-accent:             var(--ds-neutral-700);
  --sidebar-accent-foreground:  var(--ds-neutral-50);
  --sidebar-accent-background:  var(--ds-neutral-800);
  --sidebar-border:             var(--ds-neutral-700);
  --sidebar-ring:               var(--ds-brand-400);
}
```

**Step 3: Commit**

```bash
git add main/styles/tokens/semantic-light.css main/styles/tokens/semantic-dark.css
git commit -m "feat: add semantic design tokens for light and dark modes"
```

---

## Task 4: Create Token Entry Point and Refactor globals.css

**Files:**
- Create: `main/styles/index.css`
- Modify: `main/app/globals.css`

**Step 1: Create token entry point**

Create `main/styles/index.css`:

```css
/* Design System Token Entry Point */
@import "./tokens/primitives.css";
@import "./tokens/semantic-light.css";
@import "./tokens/semantic-dark.css";
```

**Step 2: Refactor globals.css**

Replace the entire `main/app/globals.css` with a clean version that imports tokens instead of hardcoding values. Keep the Tailwind theme bindings and base layer, remove all hardcoded `:root` and `.dark` color values.

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "../styles/index.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent-background: var(--sidebar-accent-background);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-background: var(--sidebar-primary-background);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent-background: var(--accent-background);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  /* Functional colors */
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
  --color-error: var(--error);
  --color-error-foreground: var(--error-foreground);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --animate-accordion-down: accordion-down 0.2s ease-out;
  --animate-accordion-up: accordion-up 0.2s ease-out;

  @keyframes accordion-down {
    from { height: 0; }
    to { height: var(--radix-accordion-content-height); }
  }

  @keyframes accordion-up {
    from { height: var(--radix-accordion-content-height); }
    to { height: 0; }
  }
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  .gray_text_sm {
    @apply text-sm text-gray-600 dark:text-gray-400;
  }

  @keyframes wave {
    0%, 100% { height: 20%; }
    50% { height: 100%; }
  }

  .animate-wave {
    animation-name: wave;
    animation-iteration-count: infinite;
    animation-timing-function: ease-in-out;
  }
}
```

Note: The `.dark body` gradient background (`linear-gradient(135deg, #b2c7ff, #d7d7fe)`) is intentionally removed. It will be redesigned in Phase 3 using tokens.

**Step 3: Verify build**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main
pnpm build
```

Expected: Build succeeds. All existing pages render with same visual appearance (tokens map to equivalent values).

**Step 4: Verify dev server visually**

```bash
pnpm dev
```

Open http://localhost:3000, confirm light and dark modes render correctly.

**Step 5: Commit**

```bash
git add main/styles/ main/app/globals.css
git commit -m "refactor: replace hardcoded CSS variables with design token imports"
```

---

## Task 5: Set Up Storybook 10

**Files:**
- Create: `main/.storybook/main.ts`
- Create: `main/.storybook/preview.ts`
- Modify: `main/package.json` (via pnpm add)

**Step 1: Install Storybook 10**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main
pnpm dlx storybook@latest init --framework @storybook/nextjs-vite --skip-install
pnpm install
```

If the init command generates example stories, delete them:
```bash
rm -rf main/stories/
```

**Step 2: Configure main.ts**

Verify/update `main/.storybook/main.ts`:

```ts
import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
  stories: [
    "../components/**/*.stories.@(ts|tsx)",
    "../stories/**/*.stories.@(ts|tsx)",
  ],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
  ],
  framework: "@storybook/nextjs-vite",
};

export default config;
```

**Step 3: Configure preview.ts**

Create/update `main/.storybook/preview.ts`:

```ts
import type { Preview } from "@storybook/react";
import "../app/globals.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: { disable: true },
  },
  globalTypes: {
    theme: {
      description: "Theme",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme || "light";
      return (
        <div className={theme === "dark" ? "dark" : ""}>
          <div className="bg-background text-foreground p-6 min-h-screen">
            <Story />
          </div>
        </div>
      );
    },
  ],
};

export default preview;
```

**Step 4: Add storybook scripts to package.json**

Verify these scripts exist (storybook init may have added them):

```json
{
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  }
}
```

**Step 5: Verify Storybook launches**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main
pnpm storybook
```

Expected: Storybook opens at http://localhost:6006 with empty sidebar (no stories yet).

**Step 6: Commit**

```bash
git add main/.storybook/ main/package.json main/pnpm-lock.yaml
git commit -m "feat: set up Storybook 10 with @storybook/nextjs-vite"
```

---

## Task 6: Write Foundations Stories

**Files:**
- Create: `main/stories/foundations/Colors.stories.tsx`
- Create: `main/stories/foundations/Typography.stories.tsx`
- Create: `main/stories/foundations/Spacing.stories.tsx`
- Create: `main/stories/foundations/Shadows.stories.tsx`

**Step 1: Create stories directory**

```bash
mkdir -p /Users/fun/Documents/GitHub/dimsum-app/main/stories/foundations
```

**Step 2: Write Colors story**

Create `main/stories/foundations/Colors.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react";

const colorScales = {
  Brand: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  Neutral: [0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  Red: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900],
  Green: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900],
  Amber: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900],
  Blue: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900],
};

function ColorSwatch({ name, cssVar }: { name: string; cssVar: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-12 h-12 rounded-lg border border-border shrink-0"
        style={{ backgroundColor: `var(${cssVar})` }}
      />
      <div>
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-muted-foreground font-mono">{cssVar}</div>
      </div>
    </div>
  );
}

function ColorScale({ name, steps }: { name: string; steps: number[] }) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-3">{name}</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {steps.map((step) => (
          <ColorSwatch
            key={step}
            name={`${name} ${step}`}
            cssVar={`--ds-${name.toLowerCase()}-${step}`}
          />
        ))}
      </div>
    </div>
  );
}

const semanticColors = [
  { name: "Background", var: "--background" },
  { name: "Foreground", var: "--foreground" },
  { name: "Primary", var: "--primary" },
  { name: "Primary Foreground", var: "--primary-foreground" },
  { name: "Secondary", var: "--secondary" },
  { name: "Muted", var: "--muted" },
  { name: "Muted Foreground", var: "--muted-foreground" },
  { name: "Accent", var: "--accent" },
  { name: "Destructive", var: "--destructive" },
  { name: "Border", var: "--border" },
  { name: "Ring", var: "--ring" },
  { name: "Success", var: "--success" },
  { name: "Warning", var: "--warning" },
  { name: "Info", var: "--info" },
  { name: "Error", var: "--error" },
];

function ColorsPage() {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-bold mb-6">Semantic Colors</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {semanticColors.map((color) => (
            <ColorSwatch key={color.var} name={color.name} cssVar={color.var} />
          ))}
        </div>
      </div>
      <hr className="border-border" />
      <div>
        <h2 className="text-2xl font-bold mb-6">Primitive Color Scales</h2>
        <div className="space-y-8">
          {Object.entries(colorScales).map(([name, steps]) => (
            <ColorScale key={name} name={name} steps={steps} />
          ))}
        </div>
      </div>
    </div>
  );
}

const meta: Meta = {
  title: "Foundations/Colors",
  component: ColorsPage,
};
export default meta;

export const Default: StoryObj = {};
```

**Step 3: Write Typography story**

Create `main/stories/foundations/Typography.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react";

const fontSizes = [
  { name: "xs", var: "--ds-font-size-xs", px: "12px" },
  { name: "sm", var: "--ds-font-size-sm", px: "14px" },
  { name: "md", var: "--ds-font-size-md", px: "16px" },
  { name: "lg", var: "--ds-font-size-lg", px: "18px" },
  { name: "xl", var: "--ds-font-size-xl", px: "20px" },
  { name: "2xl", var: "--ds-font-size-2xl", px: "24px" },
  { name: "3xl", var: "--ds-font-size-3xl", px: "30px" },
  { name: "4xl", var: "--ds-font-size-4xl", px: "36px" },
];

const fontWeights = [
  { name: "Normal", var: "--ds-font-weight-normal", value: 400 },
  { name: "Medium", var: "--ds-font-weight-medium", value: 500 },
  { name: "Semibold", var: "--ds-font-weight-semibold", value: 600 },
  { name: "Bold", var: "--ds-font-weight-bold", value: 700 },
];

function TypographyPage() {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-bold mb-6">Font Size Scale</h2>
        <div className="space-y-4">
          {fontSizes.map((size) => (
            <div key={size.name} className="flex items-baseline gap-4">
              <span className="text-sm text-muted-foreground w-24 shrink-0 font-mono">
                {size.name} ({size.px})
              </span>
              <span style={{ fontSize: `var(${size.var})` }}>
                The quick brown fox jumps over the lazy dog
              </span>
            </div>
          ))}
        </div>
      </div>
      <hr className="border-border" />
      <div>
        <h2 className="text-2xl font-bold mb-6">Font Weights</h2>
        <div className="space-y-4">
          {fontWeights.map((weight) => (
            <div key={weight.name} className="flex items-baseline gap-4">
              <span className="text-sm text-muted-foreground w-24 shrink-0 font-mono">
                {weight.value}
              </span>
              <span className="text-xl" style={{ fontWeight: weight.value }}>
                {weight.name} — The quick brown fox jumps over the lazy dog
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const meta: Meta = {
  title: "Foundations/Typography",
  component: TypographyPage,
};
export default meta;

export const Default: StoryObj = {};
```

**Step 4: Write Spacing story**

Create `main/stories/foundations/Spacing.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react";

const spacingScale = [
  { name: "0.5", var: "--ds-space-0\\.5", px: "2px" },
  { name: "1", var: "--ds-space-1", px: "4px" },
  { name: "1.5", var: "--ds-space-1\\.5", px: "6px" },
  { name: "2", var: "--ds-space-2", px: "8px" },
  { name: "3", var: "--ds-space-3", px: "12px" },
  { name: "4", var: "--ds-space-4", px: "16px" },
  { name: "5", var: "--ds-space-5", px: "20px" },
  { name: "6", var: "--ds-space-6", px: "24px" },
  { name: "8", var: "--ds-space-8", px: "32px" },
  { name: "10", var: "--ds-space-10", px: "40px" },
  { name: "12", var: "--ds-space-12", px: "48px" },
  { name: "16", var: "--ds-space-16", px: "64px" },
  { name: "20", var: "--ds-space-20", px: "80px" },
  { name: "24", var: "--ds-space-24", px: "96px" },
];

function SpacingPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Spacing Scale (4px base)</h2>
      <div className="space-y-3">
        {spacingScale.map((space) => (
          <div key={space.name} className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground w-20 shrink-0 font-mono text-right">
              {space.name} ({space.px})
            </span>
            <div
              className="h-4 bg-primary rounded-sm"
              style={{ width: space.px }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const meta: Meta = {
  title: "Foundations/Spacing",
  component: SpacingPage,
};
export default meta;

export const Default: StoryObj = {};
```

**Step 5: Write Shadows story**

Create `main/stories/foundations/Shadows.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react";

const shadows = [
  { name: "xs", var: "--ds-shadow-xs" },
  { name: "sm", var: "--ds-shadow-sm" },
  { name: "md", var: "--ds-shadow-md" },
  { name: "lg", var: "--ds-shadow-lg" },
  { name: "xl", var: "--ds-shadow-xl" },
  { name: "2xl", var: "--ds-shadow-2xl" },
];

function ShadowsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Shadow Scale</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
        {shadows.map((shadow) => (
          <div key={shadow.name} className="text-center space-y-3">
            <div
              className="w-full h-24 rounded-lg bg-card"
              style={{ boxShadow: `var(${shadow.var})` }}
            />
            <div className="text-sm font-medium">{shadow.name}</div>
            <div className="text-xs text-muted-foreground font-mono">{shadow.var}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const meta: Meta = {
  title: "Foundations/Shadows",
  component: ShadowsPage,
};
export default meta;

export const Default: StoryObj = {};
```

**Step 6: Verify in Storybook**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main
pnpm storybook
```

Expected: Storybook sidebar shows `Foundations` > `Colors`, `Typography`, `Spacing`, `Shadows`. All render correctly in both light and dark modes (toggle via toolbar).

**Step 7: Commit**

```bash
git add main/stories/foundations/
git commit -m "feat: add Foundations stories (Colors, Typography, Spacing, Shadows)"
```

---

## Task 7: Refactor Button Component + Story (P0 Exemplar)

**Files:**
- Modify: `main/components/ui/button.tsx`
- Create: `main/components/ui/button.stories.tsx`

**Step 1: Read the current button implementation**

Read `main/components/ui/button.tsx` to understand current variants, sizes, and CVA configuration.

**Step 2: Refactor button to use semantic tokens**

Update the CVA configuration in `button.tsx` to ensure all color references use semantic tokens via Tailwind classes that map to CSS variables (e.g. `bg-primary`, `text-primary-foreground`). The existing shadcn button likely already does this — verify and adjust if any hardcoded colors exist.

**Step 3: Write button stories**

Create `main/components/ui/button.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: { children: "Button" },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="default">Default</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button disabled>Default</Button>
      <Button variant="destructive" disabled>Destructive</Button>
      <Button variant="outline" disabled>Outline</Button>
      <Button variant="secondary" disabled>Secondary</Button>
    </div>
  ),
};
```

**Step 4: Verify in Storybook**

```bash
pnpm storybook
```

Expected: `Components` > `Button` shows in sidebar with autodocs page, all variants render in both themes.

**Step 5: Commit**

```bash
git add main/components/ui/button.tsx main/components/ui/button.stories.tsx
git commit -m "feat: add Button stories, verify token integration"
```

---

## Task 8: Write Stories for Remaining P0 Components

Repeat the pattern from Task 7 for each P0 component. Create one story file per component, co-located next to the component.

**Components to cover (in order):**
1. `input.tsx` → `input.stories.tsx`
2. `card.tsx` → `card.stories.tsx`
3. `badge.tsx` → `badge.stories.tsx`
4. `dialog.tsx` → `dialog.stories.tsx`
5. `select.tsx` → `select.stories.tsx`
6. `table.tsx` → `table.stories.tsx`
7. `tabs.tsx` → `tabs.stories.tsx`
8. `form.tsx` → `form.stories.tsx`
9. `avatar.tsx` → `avatar.stories.tsx`

**For each component:**

1. Read the current implementation
2. Check for hardcoded colors — replace with semantic token Tailwind classes
3. Write a story with: Default, AllVariants (if applicable), AllSizes (if applicable)
4. Enable `tags: ["autodocs"]`
5. Verify in Storybook (both themes)
6. Commit: `feat: add [Component] story`

**Step: Commit all P0 stories**

After all P0 components are done:
```bash
git add main/components/ui/*.stories.tsx
git commit -m "feat: complete P0 component stories (input, card, badge, dialog, select, table, tabs, form, avatar)"
```

---

## Task 9: Clean Up Duplicate Components

**Files:**
- Modify/Delete: `main/components/ui/slider2.tsx`
- Modify/Delete: `main/components/ui/tooltip2.tsx`
- Modify: `main/components/ui/slider.tsx` (if merging features)
- Modify: `main/components/ui/tooltip.tsx` (if merging features)

**Step 1: Compare slider vs slider2**

Read both files. Identify what slider2 adds that slider doesn't. Decide:
- If slider2 is just a variant → merge into slider with a variant prop
- If slider2 is unused → delete it

**Step 2: Compare tooltip vs tooltip2**

Same comparison approach.

**Step 3: Search for usages**

```bash
# From main/ directory
grep -r "slider2\|Slider2" --include="*.tsx" --include="*.ts" -l
grep -r "tooltip2\|Tooltip2" --include="*.tsx" --include="*.ts" -l
```

**Step 4: Merge or delete**

Apply the decision from Step 1-2. Update any import references found in Step 3.

**Step 5: Commit**

```bash
git add -A main/components/ui/
git commit -m "refactor: merge duplicate slider and tooltip components"
```

---

## Task 10: Write Stories for P1 Components

Same pattern as Task 8, covering:
1. `dropdown-menu.tsx`
2. `sheet.tsx`
3. `popover.tsx`
4. `tooltip.tsx`
5. `checkbox.tsx`
6. `radio-group.tsx`
7. `switch.tsx`
8. `textarea.tsx`
9. `separator.tsx`
10. `skeleton.tsx`

**Commit:**
```bash
git add main/components/ui/*.stories.tsx
git commit -m "feat: complete P1 component stories"
```

---

## Summary: Execution Order

| Task | Description | Depends On |
|------|-------------|-----------|
| 1 | Upgrade Next.js 15 → 16 | — |
| 2 | Create primitive tokens | — |
| 3 | Create semantic tokens | Task 2 |
| 4 | Refactor globals.css | Task 2, 3 |
| 5 | Set up Storybook 10 | Task 1 |
| 6 | Write Foundations stories | Task 4, 5 |
| 7 | Button component + story (exemplar) | Task 4, 5 |
| 8 | Remaining P0 component stories | Task 7 |
| 9 | Clean up duplicate components | Task 8 |
| 10 | P1 component stories | Task 9 |

Tasks 1 and 2 can run in parallel.
Tasks 3 depends on 2. Task 4 depends on 2+3.
Task 5 depends on 1. Tasks 6-7 depend on 4+5.
