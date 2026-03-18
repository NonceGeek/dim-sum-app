# dimsum-app UI Redesign & Design System

**Date**: 2026-03-18
**Status**: Approved
**Approach**: Design Tokens Driven (Approach A) — Gradual improvement

## Goals

1. Build a Design Token system (primitive -> semantic -> component) as the visual language foundation
2. Set up Storybook 10 with `@storybook/nextjs-vite` for component documentation
3. Refactor existing shadcn/ui components to consume tokens, with full Storybook coverage
4. Optimize page experience across all routes
5. Upgrade Next.js 15 -> 16, brand new custom visual style

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Approach | Gradual improvement on existing shadcn/ui | Pragmatic — avoids big-bang rewrite |
| Visual style | Brand new custom style | Full OKLCH token system, not tied to movement-design-system |
| Storybook location | In dimsum-app directly | Component docs co-located with app code |
| Storybook framework | `@storybook/nextjs-vite` | 17 component files use next/image, next/link, next/navigation — auto-stubbing needed |
| Storybook version | v10 (10.2.x) | Only v10 supports Next.js 16 |
| Next.js upgrade | 15 -> 16 | User decision; requires Storybook 10 |
| Priority order | Tokens -> Components -> Pages | Foundation first, then build up |

---

## Phase 1: Design Tokens + Storybook Infrastructure

### 1.1 Three-Layer Token Architecture

```
Layer 3: Component Tokens (optional, on-demand)
  --button-bg, --card-padding, --input-height

Layer 2: Semantic Tokens (components consume this layer)
  --color-primary, --color-surface, --spacing-page, --radius-card

Layer 1: Primitive Tokens (raw design values, not used directly)
  --ds-blue-500, --ds-gray-100, --ds-space-4, --ds-font-size-md
```

### 1.2 Token Categories

| Category | Content | File |
|----------|---------|------|
| Color | Brand, neutral, functional (success/warning/error/info) | `tokens/colors.css` |
| Typography | Font size scale, weight, line-height, font family | `tokens/typography.css` |
| Spacing | Spacing scale (4px base) | `tokens/spacing.css` |
| Radius | Border radius scale | `tokens/radius.css` |
| Shadow | Shadow levels (sm/md/lg/xl) | `tokens/shadows.css` |
| Motion | Animation duration, easing functions | `tokens/motion.css` |

### 1.3 File Organization

```
main/
├── styles/
│   ├── tokens/
│   │   ├── primitives.css       # Raw values (color palette, spacing numbers)
│   │   ├── semantic-light.css   # Light mode semantic mapping
│   │   ├── semantic-dark.css    # Dark mode semantic mapping
│   │   ├── typography.css       # Font tokens
│   │   ├── spacing.css          # Spacing tokens
│   │   ├── shadows.css          # Shadow tokens
│   │   └── motion.css           # Animation tokens
│   └── index.css                # Aggregation entry point
├── app/
│   └── globals.css              # Only @imports + base layer styles
```

### 1.4 Compatibility Strategy

- Existing variable names (`--primary`, `--background`, etc.) are preserved; values change from hardcoded to referencing primitive tokens
- New tokens and old variables coexist; components migrate gradually
- All colors unified to OKLCH format (fix dark mode hex values)

### 1.5 Current Issues to Fix

- Mixed color formats: light mode uses OKLCH, dark mode mixes OKLCH and hex (`--background: #181818`, `--accent: #7b7a7a`)
- Monotone hue: nearly all colors use hue 280 (purple-blue)
- No semantic layering: CSS variables hardcoded directly in `globals.css`
- Only `--radius` exists as a token; everything else relies on Tailwind defaults
- Dark mode body uses `linear-gradient(135deg, #b2c7ff, #d7d7fe)` — disconnected from token system

### 1.6 Storybook Setup

**Tech stack:**
- Storybook v10 (10.2.x latest stable)
- `@storybook/nextjs-vite` framework
- Addons: addon-docs, addon-a11y, addon-interactions

**Directory structure:**
```
main/
├── .storybook/
│   ├── main.ts        # Storybook config
│   ├── preview.ts     # Global decorators (theme toggle, tokens import)
│   └── manager.ts     # Storybook UI customization (optional)
├── components/
│   └── ui/
│       ├── button.tsx
│       └── button.stories.tsx   # Story files co-located with components
```

**Story organization (sidebar):**
```
Foundations/            # Token visualization docs
  ├── Colors            # Color palette preview (primitive + semantic)
  ├── Typography        # Font scale preview
  ├── Spacing           # Spacing visualization
  └── Shadows           # Shadow levels preview

Components/             # General UI components
  ├── Button            # Default, Variants, Sizes, States per component
  ├── Input
  ├── Card
  └── ...

Patterns/               # Business composition patterns (Phase 3)
  ├── FormLayout
  ├── DataTable
  └── ...
```

**Theme switching:** Global decorator in `preview.ts` toggles `.dark` class for light/dark preview.

### 1.7 Next.js Upgrade (15 -> 16)

Execute before Storybook setup:
1. Upgrade `next` package to v16
2. Follow Next.js 16 migration guide
3. Verify app builds and runs correctly
4. Then install Storybook 10

---

## Phase 2: Component Library Refactoring

### 2.1 Component Batches

| Batch | Components | Strategy |
|-------|-----------|----------|
| **P0 — High frequency** | button, input, card, badge, dialog, select, table, tabs, form, avatar | Priority refactor + full Stories |
| **P1 — Medium frequency** | dropdown-menu, sheet, popover, tooltip, checkbox, radio-group, switch, textarea, separator, skeleton | Follow-up refactor |
| **P2 — Low frequency** | accordion, carousel, calendar, chart, combobox, command, drawer, hover-card, menubar, slider, slider2, tooltip2 | On-demand refactor, clean up duplicates |

### 2.2 Per-Component Refactoring Flow

```
1. Audit existing implementation
   └─ Confirm props API, variants, usage patterns

2. Apply Design Tokens
   └─ Replace hardcoded colors/spacing with token variables
   └─ Ensure light/dark modes both controlled via semantic tokens

3. Add missing variants
   └─ e.g. Button: ghost, outline, link, destructive, secondary
   └─ Unified size scale (sm, default, lg)

4. Write Story
   └─ Default + all variants + all sizes + interaction states
   └─ Enable autodocs

5. Clean up redundancy
   └─ Merge slider/slider2, tooltip/tooltip2
   └─ Remove unused components
```

### 2.3 Component API Conventions

```
Props naming:
  - variant    → Visual variant (default, outline, ghost, destructive...)
  - size       → Size (sm, default, lg)
  - disabled   → Disabled state
  - className  → Style extension entry point

Styling:
  - Continue using CVA (class-variance-authority) for variants
  - Continue using cn() for class merging
  - Colors/spacing reference semantic tokens only, no direct Tailwind color classes

Exports:
  - Named exports per component (no default export)
  - Types exported alongside components
```

### 2.4 Duplicate Component Cleanup

| File | Action |
|------|--------|
| `slider.tsx` + `slider2.tsx` | Merge into one, keep the more complete version |
| `tooltip.tsx` + `tooltip2.tsx` | Merge into one, differentiate via variant or props |
| `input.tsx` + `input-group.tsx` | Evaluate merge or convert input-group to composition pattern docs |

---

## Phase 3: Page Experience Optimization

### 3.1 Scope

| Page Area | Route | Optimization Focus |
|-----------|-------|-------------------|
| **Home** | `(home)/` | Layout rhythm, visual hierarchy, first paint |
| **Account** | `(account)/` | Form UX, state feedback, flow guidance |
| **Admin** | `admin/` | Data tables, filter interactions, information density |

### 3.2 Universal Page Improvements

**Layout system:**
- Establish page-level spacing specs: page padding, section gap, content max-width
- Unified responsive breakpoint behavior (WeChat browser mobile scenario needs attention)

**Loading & transitions:**
- Skeleton component uses motion tokens
- Page transition animations (leverage existing `motion` library)
- Unified button/form loading states

**Feedback system:**
- Toast (sonner) styles aligned with new tokens
- Unified empty state and error state visual components
- Unified form validation feedback styling (react-hook-form + zod)

**Dark mode fix:**
- Current dark body gradient `linear-gradient(135deg, #b2c7ff, #d7d7fe)` is disconnected from OKLCH system
- Bring under token management

### 3.3 Optimization Order

```
Step 1: Global layout & navigation → Sidebar aligned to tokens, page container specs
Step 2: Home page → Highest traffic, most visible improvement
Step 3: Account pages → Form UX directly impacts conversion
Step 4: Admin pages → Information density, data table improvements
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Token changes cause visual regression | Initial phase preserves old variable values, only changes source structure |
| Next.js 16 upgrade breaks existing features | Upgrade first, verify before adding Storybook |
| Brand new visual style takes long to define | Phase 1 uses placeholder values to validate architecture, swap primitive tokens after visual finalization |
| Component refactoring blocks feature dev | Batch refactoring, each batch independently mergeable |

## Key Principles

1. **No-downtime migration** — Every change is backward compatible, old variable names preserved
2. **Measurable progress** — "Component tokenized + story written" as progress metric
3. **Depth before breadth** — Complete P0 components thoroughly as exemplars before expanding

## Next.js Components Using Framework-Specific APIs

17 component files use Next.js APIs (justifying `@storybook/nextjs-vite`):

- `next/image` — 4 files (header, sidebar, edit-profile-dialog)
- `next/link` — 7 files (sidebar menus, login dialogs)
- `next/navigation` — 6 files (usePathname, useSearchParams in layout components)
- `next/font` — 0 files
- `next/router` — 0 files
