# DimSum AI Labs — Design System Specification

> **Style:** HuggingFace-inspired, blue-white academic aesthetic
> **Updated:** 2026-03-19
> **Status:** v1.0 — Post-refactor baseline

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Token Architecture](#2-token-architecture)
3. [Color System](#3-color-system)
4. [Typography](#4-typography)
5. [Spacing](#5-spacing)
6. [Border Radius](#6-border-radius)
7. [Shadows](#7-shadows)
8. [Motion](#8-motion)
9. [Layout Patterns](#9-layout-patterns)
10. [Component Conventions](#10-component-conventions)
11. [Theme Configuration](#11-theme-configuration)
12. [File Structure](#12-file-structure)

---

## 1. Design Philosophy

### Core Principles

- **HuggingFace-inspired layout**: Horizontal top-bar navigation, no sidebar for main app
- **Blue-white academic feel**: Azure blue (`hue 256`) as primary brand color, clean white surfaces in light mode, deep blue-black in dark mode
- **3-layer token architecture**: Primitives → Semantic → Component, ensuring consistent theming
- **OKLCH color space**: Perceptually uniform colors for natural transitions across the palette (hue 256)
- **shadcn/ui foundation**: 60+ Radix UI-based components with design token integration

### Visual Identity

| Aspect | Light Mode | Dark Mode |
|--------|-----------|-----------|
| Background | Clean white (`neutral-0`) | Deep blue-black (`#0c0f1a`) |
| Surface | White cards | Dark blue surface (`#1a1f35`) |
| Primary | Azure blue (`brand-600 ≈ #007fff`) | Lighter blue (`brand-400`) |
| Text | Near-black (`neutral-900`) | Light gray (`neutral-100`) |
| Borders | Subtle gray (`neutral-200`) | Dark blue-gray (`#2d3555`) |

---

## 2. Token Architecture

```
Layer 1: Primitives    →  Raw values (hue, lightness, spacing units)
Layer 2: Semantic       →  Purpose-driven aliases (--background, --primary)
Layer 3: Component      →  Component-specific overrides (reserved)
```

### File Organization

```
styles/
├── index.css                  # Entry point (imports all layers)
├── tokens/
│   ├── primitives.css         # Layer 1 — raw design values
│   ├── semantic-light.css     # Layer 2 — light theme mappings
│   └── semantic-dark.css      # Layer 2 — dark theme mappings
```

### Usage Rules

| Rule | Description |
|------|-------------|
| **Never** reference primitive tokens in components | Use semantic tokens (`--primary`, `--background`) |
| **Never** hardcode colors in components | Use `bg-primary`, `text-foreground`, etc. |
| Semantic token names match shadcn/ui | `--primary`, `--secondary`, `--muted`, etc. |
| All colors are OKLCH | Format: `oklch(lightness chroma hue)` |

---

## 3. Color System

### 3.1 Brand Colors (Hue 256 — Azure Blue)

Primary brand color targets `#007fff` at the 600 level.

| Token | Hex Value | Usage |
|-------|-----------|-------|
| `brand-50` | `#f1f6fc` | Tinted background |
| `brand-100` | `#dbe9fc` | Hover backgrounds |
| `brand-200` | `#b2d7ff` | Light accent |
| `brand-300` | `#80c0ff` | — |
| `brand-400` | `#5aa8ff` | Dark mode primary |
| `brand-500` | `#3193ff` | Ring / chart-1 |
| `brand-600` | `#007fff` | **Light mode primary** |
| `brand-700` | `#005fc6` | Hover/pressed |
| `brand-800` | `#004591` | — |
| `brand-900` | `#052f61` | — |
| `brand-950` | `#051f3f` | — |

### 3.2 Neutral Colors (Hue 256, Chroma ~0.005)

Azure-tinted grays for a cohesive feel with the brand.

| Token | OKLCH Value | Usage |
|-------|-------------|-------|
| `neutral-0` | `oklch(1.00 0.000 256)` | Pure white, light background |
| `neutral-50` | `oklch(0.98 0.003 256)` | Accent background (light) |
| `neutral-100` | `oklch(0.94 0.005 256)` | Secondary / muted (light) |
| `neutral-200` | `oklch(0.88 0.005 256)` | Border / input (light) |
| `neutral-300` | `oklch(0.80 0.005 256)` | — |
| `neutral-400` | `oklch(0.70 0.005 256)` | Muted foreground (dark) |
| `neutral-500` | `oklch(0.58 0.005 256)` | Muted foreground (light) |
| `neutral-600` | `oklch(0.48 0.005 256)` | — |
| `neutral-700` | `oklch(0.39 0.005 256)` | Sidebar border (dark) |
| `neutral-800` | `oklch(0.30 0.005 256)` | Secondary / muted (dark) |
| `neutral-900` | `oklch(0.22 0.005 256)` | Foreground (light) |
| `neutral-950` | `oklch(0.15 0.005 256)` | Sidebar background (dark) |

### 3.3 Functional Colors

| Scale | Hue | Purpose |
|-------|-----|---------|
| Red | 25 (warm red-orange) | Destructive / Error |
| Green | 155 (teal-green) | Success |
| Amber | 85 (yellow-green) | Warning |
| Blue | 240 (pure blue) | Info |

Each scale has shades 50–900. Light mode uses `-500` level, dark mode uses `-400` for contrast.

### 3.4 Dark Mode Backgrounds

Dedicated deep blue-black primitives for immersive dark mode:

| Token | OKLCH Value | Approx Hex | Semantic Mapping |
|-------|-------------|------------|------------------|
| `dark-bg` | `oklch(0.13 0.02 256)` | `#0c0f1a` | `--background` |
| `dark-surface` | `oklch(0.18 0.02 256)` | `#1a1f35` | `--card`, `--popover` |
| `dark-border` | `oklch(0.25 0.02 256)` | `#2d3555` | `--border`, `--input` |

### 3.5 Semantic Token Mapping

| Semantic Token | Light Mode | Dark Mode |
|----------------|-----------|-----------|
| `--background` | `neutral-0` | `dark-bg` |
| `--foreground` | `neutral-900` | `neutral-100` |
| `--card` | `neutral-0` | `dark-surface` |
| `--primary` | `brand-600` | `brand-400` |
| `--primary-foreground` | `neutral-0` | `neutral-950` |
| `--secondary` | `neutral-100` | `neutral-800` |
| `--muted` | `neutral-100` | `neutral-800` |
| `--muted-foreground` | `neutral-500` | `neutral-400` |
| `--accent` | `neutral-100` | `neutral-800` |
| `--accent-background` | `neutral-50` | `neutral-900` |
| `--border` | `neutral-200` | `dark-border` |
| `--ring` | `brand-500` | `brand-400` |
| `--destructive` | `red-500` | `red-400` |
| `--success` | `green-500` | `green-400` |
| `--warning` | `amber-500` | `amber-400` |
| `--info` | `blue-500` | `blue-400` |
| `--error` | `red-500` | `red-400` |

### 3.6 Chart Colors

| Token | Light | Dark |
|-------|-------|------|
| `--chart-1` | `brand-500` | `brand-400` |
| `--chart-2` | `green-500` | `green-400` |
| `--chart-3` | `amber-500` | `amber-400` |
| `--chart-4` | `blue-500` | `blue-400` |
| `--chart-5` | `red-500` | `red-400` |

---

## 4. Typography

### Font Stack

```css
--font-sans: var(--font-geist-sans);  /* Geist Sans — primary */
--font-mono: var(--font-geist-mono);  /* Geist Mono — code blocks */
```

### Scale

| Token | Size | Pixels | Usage |
|-------|------|--------|-------|
| `font-size-xs` | `0.75rem` | 12px | Captions, badges |
| `font-size-sm` | `0.875rem` | 14px | Body text, nav links, table cells |
| `font-size-md` | `1rem` | 16px | Default body |
| `font-size-lg` | `1.125rem` | 18px | Section titles |
| `font-size-xl` | `1.25rem` | 20px | Card headings |
| `font-size-2xl` | `1.5rem` | 24px | Page headings |
| `font-size-3xl` | `1.875rem` | 30px | Hero subtitle |
| `font-size-4xl` | `2.25rem` | 36px | Hero title |

### Line Heights

| Token | Value | Usage |
|-------|-------|-------|
| `line-height-tight` | `1.25` | Headings |
| `line-height-normal` | `1.5` | Body text |
| `line-height-loose` | `1.75` | Spacious reading |

### Font Weights

| Token | Value | Usage |
|-------|-------|-------|
| `font-weight-normal` | `400` | Body text |
| `font-weight-medium` | `500` | Nav links, labels |
| `font-weight-semibold` | `600` | Section headings, brand name |
| `font-weight-bold` | `700` | Hero title, emphasis |

---

## 5. Spacing

Base unit: **4px**

| Token | Value | Usage |
|-------|-------|-------|
| `spacing-0` | `0px` | — |
| `spacing-0-5` | `2px` | Micro gap |
| `spacing-1` | `4px` | Icon-text gap |
| `spacing-1-5` | `6px` | Compact padding |
| `spacing-2` | `8px` | Button padding, small gaps |
| `spacing-3` | `12px` | Card padding (compact) |
| `spacing-4` | `16px` | Standard padding |
| `spacing-5` | `20px` | — |
| `spacing-6` | `24px` | Section padding |
| `spacing-8` | `32px` | Section gaps |
| `spacing-10` | `40px` | — |
| `spacing-12` | `48px` | Large section spacing |
| `spacing-16` | `64px` | Page margins |
| `spacing-20` | `80px` | Hero padding |
| `spacing-24` | `96px` | — |

---

## 6. Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-none` | `0px` | No rounding |
| `radius-sm` | `4px` | `--radius-sm` (via `calc(var(--radius) - 4px)`) |
| `radius-md` | `6px` | `--radius-md` (via `calc(var(--radius) - 2px)`) |
| `radius-lg` | `8px` | `--radius` (base), cards, inputs |
| `radius-xl` | `12px` | `--radius-xl` (via `calc(var(--radius) + 4px)`) |
| `radius-2xl` | `16px` | Large cards |
| `radius-full` | `9999px` | Pills, avatars |

The shadcn/ui `--radius` is set to `var(--ds-radius-lg)` = `8px`. All other radii derive from it.

---

## 7. Shadows

All shadows use OKLCH with the neutral-900 hue for natural blending:

| Token | Layers | Usage |
|-------|--------|-------|
| `shadow-xs` | 1 layer, 5% opacity | Subtle depth |
| `shadow-sm` | 2 layers, 10% opacity | Card hover state |
| `shadow-md` | 2 layers, offset 4px | Default card shadow |
| `shadow-lg` | 2 layers, offset 10px | Dropdowns, popovers |
| `shadow-xl` | 2 layers, offset 20px | Modals |
| `shadow-2xl` | 1 layer, 25% opacity | Elevated overlays |

---

## 8. Motion

### Durations

| Token | Value | Usage |
|-------|-------|-------|
| `duration-fast` | `100ms` | Hover states, toggle |
| `duration-normal` | `200ms` | Standard transitions |
| `duration-slow` | `300ms` | Slide-in, expand |
| `duration-slower` | `500ms` | Page transitions |

### Easings

| Token | Curve | Usage |
|-------|-------|-------|
| `ease-default` | `cubic-bezier(0.25, 0.10, 0.25, 1.00)` | General purpose |
| `ease-in` | `cubic-bezier(0.42, 0.00, 1.00, 1.00)` | Exit animations |
| `ease-out` | `cubic-bezier(0.00, 0.00, 0.58, 1.00)` | Enter animations |
| `ease-in-out` | `cubic-bezier(0.42, 0.00, 0.58, 1.00)` | Symmetric |
| `ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1.00)` | Bouncy / playful |

### Animation Library

Uses `motion/react` (Framer Motion) for complex animations:
- `AnimatePresence` for enter/exit transitions
- `motion.div` for animated containers (e.g., hero section collapse, search results)

---

## 9. Layout Patterns

### 9.1 Header (Horizontal Top Bar)

```
┌──────────────────────────────────────────────────────┐
│  [Logo] DimSum AI   Home  Library  AppStore  Docs    │
│                                    [Admin] [🌙] [👤] │
└──────────────────────────────────────────────────────┘
```

**Specifications:**
- Position: `sticky top-0 z-50`
- Background: `bg-background/80 backdrop-blur-md`
- Height: `h-14` (56px)
- Border: `border-b`
- Container: `container mx-auto px-4`
- Nav links: `text-sm font-medium rounded-md px-3 py-1.5`
- Active state: `text-foreground bg-accent`
- Inactive state: `text-muted-foreground hover:text-foreground hover:bg-accent/50`
- Mobile: Sheet drawer from right, triggered by hamburger icon at `md:hidden`

**User Menu (authenticated):**
- Avatar (24px) + name + chevron dropdown
- Dropdown width: `w-48`
- Contains: account links, workplace links, sign out

### 9.2 Footer (Multi-Column)

```
┌──────────────────────────────────────────────────────┐
│  [Logo] DimSum AI Labs   Website    Company  Resources│
│  [🌙]                    Home       About    Docs     │
│                          Library    Terms              │
│                          App Store  Privacy            │
│                          Docs                          │
│──────────────────────────────────────────────────────│
│  © 2026 DIMSUM AI Labs              苏ICP备2025170597号│
└──────────────────────────────────────────────────────┘
```

**Specifications:**
- Background: `bg-background border-t`
- Container: `container mx-auto px-6 py-8`
- Grid: `grid-cols-2 md:grid-cols-4 gap-8`
- Brand column: Logo (24px) + brand name + ThemeToggle
- Link headings: `text-sm font-semibold text-foreground mb-3`
- Links: `text-sm text-muted-foreground hover:text-foreground`
- Bottom bar: `border-t mt-8 pt-6`, flex row with copyright + ICP number

### 9.3 Homepage Hero Section

**Full hero (no search results):**
```
┌──────────────────────────────────────────────────────┐
│          ░░░░░░ Dark Gradient Background ░░░░░░      │
│                                                       │
│              DimSum AI Labs                           │
│          Discover and explore AI resources             │
│                                                       │
│      [ 🔍 Search prompt...          ] [Search]       │
│              [Browse Library] | [Explore App Store]   │
│                                                       │
│      (example1) (example2) (example3) (example4)     │
│                                                       │
└──────────────────────────────────────────────────────┘
```

**Collapsed hero (with results):**
```
┌──────────────────────────────────────────────────────┐
│  Light gradient background                           │
│  [ 🔍 Search prompt...              ] [Search]       │
└──────────────────────────────────────────────────────┘
│  [Results list...]                                    │
```

**Specifications:**
- Full hero gradient: `bg-gradient-to-br from-[#0c0f1a] via-[#1a1f35] to-[#0c0f1a]`
- Full hero padding: `py-20 px-6`
- Title: `text-3xl md:text-4xl font-bold text-white`
- Subtitle: `text-lg text-white/70`
- Search input on dark hero: `bg-white text-foreground` override
- CTA links: `text-white/80 hover:text-white underline underline-offset-4`
- Example pills: `rounded-full border px-3 py-1 text-xs` with conditional dark/light styling
- Collapsed hero gradient: `bg-gradient-to-r from-primary/5 to-primary/10`
- Collapsed hero padding: `py-4 px-6`

### 9.4 General Page Layout

```
┌── Header (sticky) ──────────────────┐
│                                      │
│  ┌── Content Area ────────────────┐  │
│  │  min-h-[calc(100vh-56px)]      │  │
│  │                                │  │
│  └────────────────────────────────┘  │
│                                      │
│── Footer ────────────────────────────│
```

- No sidebar in main app flow
- Account pages: `min-h-screen bg-accent-background` with Header on top
- Content uses `container mx-auto` for consistent max-width

---

## 10. Component Conventions

### 10.1 UI Components (shadcn/ui)

All components are from shadcn/ui built on Radix UI primitives. Installed components include:

**Layout:** `card`, `separator`, `scroll-area`, `sheet`, `collapsible`, `resizable`
**Navigation:** `dropdown-menu`, `navigation-menu`, `tabs`, `breadcrumb`, `pagination`, `command`
**Forms:** `button`, `input`, `textarea`, `select`, `checkbox`, `radio-group`, `switch`, `slider`, `form`, `label`
**Feedback:** `alert`, `alert-dialog`, `dialog`, `drawer`, `popover`, `tooltip`, `sonner` (toast)
**Data:** `table`, `badge`, `avatar`, `progress`, `skeleton`, `chart`
**Misc:** `accordion`, `aspect-ratio`, `calendar`, `carousel`, `context-menu`, `hover-card`, `menubar`, `toggle`, `toggle-group`

### 10.2 Tailwind Usage

```css
/* Import chain */
@import "tailwindcss";
@import "tw-animate-css";
@import "../styles/index.css";

/* Dark mode variant */
@custom-variant dark (&:is(.dark *));

/* @theme inline bridges CSS vars to Tailwind utilities */
@theme inline {
  --color-background: var(--background);
  --color-primary: var(--primary);
  /* ... etc */
}
```

**Key patterns:**
- Use `bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground` etc.
- Border radius: `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`
- All derived from the `--radius` base variable
- Dark mode: Handled automatically via `.dark` class (next-themes)

### 10.3 Button Variants

| Variant | Light | Dark |
|---------|-------|------|
| `default` | `bg-primary text-primary-foreground` | Auto via tokens |
| `secondary` | `bg-secondary text-secondary-foreground` | Auto via tokens |
| `ghost` | Transparent, hover `bg-accent` | Auto via tokens |
| `outline` | `border border-input` | Auto via tokens |
| `destructive` | `bg-destructive` | Auto via tokens |

### 10.4 Navigation States

**Active nav link:**
```
text-foreground bg-accent
```

**Inactive nav link:**
```
text-muted-foreground hover:text-foreground hover:bg-accent/50
```

**Transition:** `transition-colors` (default duration)

---

## 11. Theme Configuration

### Theme Provider

Uses `next-themes` with:
- Attribute: `class` (adds `.dark` to `<html>`)
- Default theme: `system`
- Available: `light`, `dark`, `system`
- Toggle component: `ThemeToggle` (icon button with sun/moon)

### How Theming Works

```
next-themes adds .dark class to <html>
    ↓
semantic-dark.css overrides semantic-light.css variables
    ↓
@theme inline bridges CSS vars → Tailwind classes
    ↓
Components use Tailwind utilities (bg-background, text-primary, etc.)
    ↓
Colors automatically switch between themes
```

### Adding New Semantic Tokens

1. Define the primitive in `primitives.css` (if new color needed)
2. Map it in `semantic-light.css` (`:root {}`) and `semantic-dark.css` (`.dark {}`)
3. Bridge it in `globals.css` under `@theme inline { --color-<name>: var(--<name>); }`
4. Use as `bg-<name>` or `text-<name>` in components

---

## 12. File Structure

```
main/
├── app/
│   ├── globals.css              # Tailwind + @theme inline config
│   ├── layout.tsx               # Root layout (ThemeProvider, fonts)
│   ├── (home)/
│   │   ├── layout.tsx           # Home layout (Header + Footer)
│   │   └── page.tsx             # Homepage with dark hero
│   └── (account)/
│       └── layout.tsx           # Account layout (Header + accent bg)
├── components/
│   ├── layout/
│   │   ├── header.tsx           # Horizontal nav header
│   │   ├── Footer.tsx           # Multi-column footer
│   │   ├── main-layout.tsx      # Pass-through wrapper
│   │   └── conditional-layout.tsx  # Pass-through wrapper
│   ├── ui/                      # shadcn/ui components (60+)
│   ├── theme-toggle/            # Light/dark/system toggle
│   └── dialogs/                 # Auth dialogs (login, role select)
├── styles/
│   ├── index.css                # Token import entry point
│   └── tokens/
│       ├── primitives.css       # Layer 1: raw values (OKLCH)
│       ├── semantic-light.css   # Layer 2: light theme
│       └── semantic-dark.css    # Layer 2: dark theme
└── lib/
    ├── utils.ts                 # cn() helper (clsx + tailwind-merge)
    └── store/
        └── useAuthStore.ts      # Zustand auth state
```

---

## Appendix: Quick Reference

### Color Usage Cheatsheet

```tsx
// Backgrounds
<div className="bg-background" />       // Page background
<div className="bg-card" />             // Card surface
<div className="bg-muted" />            // Subdued area
<div className="bg-accent" />           // Highlighted area
<div className="bg-primary" />          // Brand-colored area

// Text
<p className="text-foreground" />        // Primary text
<p className="text-muted-foreground" />  // Secondary text
<p className="text-primary" />           // Brand-colored text

// Borders
<div className="border-border" />        // Default border
<div className="border-input" />         // Form input border

// Status
<span className="text-success" />        // Green
<span className="text-warning" />        // Amber
<span className="text-error" />          // Red
<span className="text-info" />           // Blue
```

### Dark Hero Gradient (Homepage)

```tsx
// Full dark hero (no results)
<div className="bg-gradient-to-br from-[#0c0f1a] via-[#1a1f35] to-[#0c0f1a]">
  <h1 className="text-white" />
  <p className="text-white/70" />
</div>

// Collapsed hero (with results)
<div className="bg-gradient-to-r from-primary/5 to-primary/10" />
```
