# DimSum Homepage Redesign — Google-Style Search Portal

> **Date:** 2026-03-20
> **Status:** Design approved
> **Approach:** A+B hybrid — Google minimal layout + subtle brand atmosphere

---

## 1. Design Goal

Transform the DimSum homepage from a traditional search+results dashboard into a Google/Baidu-style search portal:

- **Search-centric**: Logo + search bar as the sole visual focus
- **No header**: Navigation floats in the top-right corner
- **Hot search pills**: Lightweight discovery below the search bar
- **Real-time suggestions**: Dropdown autocomplete, click to navigate
- **Separate results page**: Search results move to `/search?q=xxx`

---

## 2. Page Layout

### 2.1 Homepage (`/(home)/page.tsx`)

```
┌─────────────────────────────────────────────────┐
│                     Library  App Store  Docs  [🌙] [👤]│
│                                                  │
│          ░░░ subtle radial gradient ░░░          │
│                                                  │
│                 ┌──────────┐                     │
│                 │  DimSum  │                     │
│                 │   Logo   │                     │
│                 └──────────┘                     │
│              DimSum AI Labs                      │
│       Discover and explore AI resources          │
│                                                  │
│    ┌──────────────────────────────────┐          │
│    │ 🔍 搜索 AI 模型、工具、资源...     │ [搜索]  │
│    ├──────────────────────────────────┤          │
│    │ ▸ LLaMA 3 — 模型              │          │
│    │ ▸ LLaMA 2 — 模型              │          │
│    └──────────────────────────────────┘          │
│                                                  │
│    🔥 落花流水  唔听  行  姐姐  歡聚一堂  帆船     │
│                                                  │
│                                                  │
│─────────────────────────────────────────────────│
│  © 2026 DimSum AI Labs          苏ICP备xxxxx号  │
└─────────────────────────────────────────────────┘
```

### 2.2 Search Results Page (`/(home)/search/page.tsx`)

- Full Header (current design) + search bar in header
- Category filters + result cards + pagination
- Inherits all current search result logic from the existing homepage

---

## 3. Component Architecture

### New Components

| Component | File | Responsibility |
|-----------|------|----------------|
| `HomePage` | `app/(home)/page.tsx` | Page container, vertical centering |
| `FloatingNav` | `components/layout/floating-nav.tsx` | Top-right navigation links + theme toggle + user menu |
| `BrandLogo` | `app/(home)/_components/brand-logo.tsx` | Logo image + brand name + subtitle |
| `HomeSearchBar` | `app/(home)/_components/home-search-bar.tsx` | Large pill search input + embedded search button |
| `SearchSuggestions` | `app/(home)/_components/search-suggestions.tsx` | Dropdown suggestion list (max 6 items) |
| `HotSearchPills` | `app/(home)/_components/hot-search-pills.tsx` | Trending search term pills |
| `MinimalFooter` | `app/(home)/_components/minimal-footer.tsx` | Single-line copyright + ICP |

### Modified Components

| Component | Change |
|-----------|--------|
| `app/(home)/layout.tsx` | Conditionally render Header (hide on homepage, show on search page) |
| `components/layout/header.tsx` | No changes needed; just hidden on homepage via layout |

### New Route

| Route | File | Purpose |
|-------|------|---------|
| `/search` | `app/(home)/search/page.tsx` | Search results page (migrated from current homepage logic) |

---

## 4. Visual Specifications

### 4.1 Background

**Light mode:**
```css
background: white;
/* Centered radial gradient — subtle Azure Blue glow */
background-image: radial-gradient(
  ellipse at 50% 40%,
  oklch(0.95 0.02 256 / 0.08),
  transparent 70%
);
```

**Dark mode:**
```css
background: var(--background); /* dark-bg: #0c0f1a */
background-image: radial-gradient(
  ellipse at 50% 40%,
  oklch(0.20 0.03 256 / 0.15),
  transparent 70%
);
```

### 4.2 Vertical Positioning

- Visual center at ~38% height (slightly above true center, like Google)
- Implementation: `min-h-[calc(100vh-48px)]` + `pt-[25vh]` or flex with offset
- Footer pinned to bottom: `mt-auto`

### 4.3 Search Bar

| Property | Value |
|----------|-------|
| Max width | `max-w-[580px]` |
| Height | `h-12` (48px) |
| Border radius | `rounded-full` |
| Border | `border border-border` |
| Shadow (default) | `shadow-sm` |
| Shadow (hover) | `shadow-md` |
| Shadow (focus) | `shadow-md` + `ring-2 ring-primary/30` |
| Search icon | Left side, `text-muted-foreground` |
| Search button | Right side, `bg-primary text-primary-foreground rounded-full h-9 px-4` |
| Placeholder | `搜索 AI 模型、工具、资源...` |

### 4.4 Search Suggestions Dropdown

| Property | Value |
|----------|-------|
| Position | Below search bar, same width |
| Max items | 6 |
| Item height | `h-10` (40px) |
| Item layout | Icon + name + type badge |
| Border radius | `rounded-2xl` (matches search bar feel) |
| Shadow | `shadow-lg` |
| Background | `bg-card` |
| Hover | `bg-accent` |
| Debounce | 300ms |

### 4.5 Hot Search Pills

| Property | Value |
|----------|-------|
| Layout | Flex wrap, centered, `gap-2` |
| Pill style | `rounded-full border px-3 py-1.5 text-sm cursor-pointer` |
| Default | `text-muted-foreground border-border` |
| Hover | `text-primary border-primary/30 bg-primary/5` |
| Prefix | `🔥` emoji before the pill group (not per pill) |
| Click behavior | Sets search query and navigates to `/search?q=xxx` |

### 4.6 Floating Navigation

| Property | Value |
|----------|-------|
| Position | `fixed top-4 right-6 z-50` |
| Links | `text-sm text-muted-foreground hover:text-foreground` |
| Gap | `gap-4 items-center` |
| Items | Library, App Store, Docs, ThemeToggle, UserAvatar |
| Mobile | Collapse to hamburger menu icon (Sheet) |

### 4.7 Minimal Footer

| Property | Value |
|----------|-------|
| Layout | `flex justify-between items-center px-6 py-4` |
| Text | `text-xs text-muted-foreground` |
| Left | `© 2026 DimSum AI Labs` |
| Right | `苏ICP备2025170597号` |
| Position | Bottom of page via `mt-auto` in flex column layout |

---

## 5. Interaction Behavior

### 5.1 Search Flow

1. User types in search bar → debounce 300ms → fetch suggestions
2. Suggestions dropdown appears below search bar
3. Each suggestion shows: result name + type label (模型/工具/文档)
4. **Click suggestion** → navigate to detail page (e.g., `/library/item-id`)
5. **Press Enter** → navigate to `/search?q={query}` (full results page)
6. **Press Escape** or click outside → close dropdown
7. **Arrow keys** → navigate suggestions
8. **Click hot search pill** → navigate to `/search?q={pill-text}`

### 5.2 Page Transitions

- Homepage → Search results: standard Next.js navigation with top loader
- No collapse/expand animation needed (different pages)

---

## 6. Responsive Design

| Breakpoint | Changes |
|------------|---------|
| Mobile (<640px) | Logo smaller (32px), search bar `w-full mx-4`, pills wrap to 2 rows, FloatingNav → hamburger Sheet |
| Tablet (640-1024px) | Search bar `max-w-[480px]`, full nav links |
| Desktop (>1024px) | Search bar `max-w-[580px]`, full layout |

---

## 7. Data Requirements

### Hot Search Pills
- Source: Static list initially (from current example pills: 落花流水, 唔听, 行, 姐姐, 歡聚一堂, 帆船)
- Future: Could be dynamic from API (popular searches)

### Search Suggestions
- Reuse existing `useSearch` hook from `lib/api/search.ts`
- Limit to 6 results in dropdown mode
- Show result type as badge

---

## 8. Migration Plan (High Level)

1. **Create `/search` route** — move current search results logic from homepage
2. **Refactor homepage** — replace with Google-style search portal
3. **Create new components** — FloatingNav, HomeSearchBar, SearchSuggestions, HotSearchPills, MinimalFooter
4. **Update layout** — conditionally hide Header on homepage
5. **Test** — verify search flow, routing, responsive, dark mode
