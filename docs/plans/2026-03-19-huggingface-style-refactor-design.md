# HuggingFace Style Refactor Design

## Overview

Refactor dimsum-app's visual style and layout to match HuggingFace's design language. Remove the sidebar navigation, adopt a top-bar navigation pattern, and apply a modern blue-white academic color scheme.

## Decisions

- **Navigation**: HuggingFace-style horizontal top bar (no sidebar)
- **Color**: Modern bright blue (`#2563eb`) as primary, black-white-gray base, deep blue-black dark theme
- **Homepage**: Dark gradient hero + search + example cards + feature showcase
- **All functionality**: Preserved, no feature changes

## Layout Architecture

### Before (Current)
```
SidebarProvider
├── AppSidebar (collapsible left sidebar)
└── Main content area
```

### After (New)
```
Header (horizontal nav + user dropdown)
├── Full-width content area
Footer (HF-style multi-column)
```

## Header Design

Desktop:
```
[Logo] DimSum AI  Home  Library  App Store  Docs  |  🔍  🌙  👤
```

Mobile:
```
[Logo] DimSum AI                              🔍  🌙  ☰
```

- Left: Logo + brand name + horizontal nav links
- Right: Global search (collapsible) + theme toggle + user avatar dropdown
- User dropdown contains: My Account, My Record, Data Annotation, Workplace/API, Admin Panel (if admin), Logout
- Mobile: hamburger opens Sheet drawer with all nav items

## Color Scheme

### Light Theme
| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `#2563eb` (Blue-600) | Buttons, links, brand accent |
| `--primary-hover` | `#1d4ed8` (Blue-700) | Hover states |
| `--accent` | `#0ea5e9` (Sky-500) | Secondary accent, tags |
| `--background` | `#ffffff` | Page background |
| `--surface` | `#f1f5f9` (Slate-100) | Card/section backgrounds |
| `--border` | `#e2e8f0` (Slate-200) | Borders |
| `--foreground` | `#1e293b` (Slate-800) | Primary text |
| `--muted-foreground` | `#94a3b8` (Slate-400) | Secondary text |
| `--success` | `#10b981` | Success state |
| `--warning` | `#f59e0b` | Warning state |
| `--error` | `#ef4444` | Error state |

### Dark Theme
| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `#3b82f6` (Blue-500) | Brand accent |
| `--background` | `#0c0f1a` | Deep blue-black background |
| `--surface` | `#1a1f35` | Card/section backgrounds |
| `--border` | `#2d3555` | Borders |
| `--foreground` | `#e2e8f0` (Slate-200) | Primary text |
| `--muted-foreground` | `#94a3b8` | Secondary text |

## Homepage Redesign

1. Dark gradient Hero section (deep blue gradient) with:
   - Title: "Try Some Cantonese"
   - Subtitle: descriptive text
   - Embedded search bar + dataset selector
   - CTA links: "Browse Library" | "Explore App Store"
2. Example search pills below hero
3. Feature showcase cards (Lyrics, Dictionary, 3D Models, etc.)
4. Data stats link

Search results: Hero shrinks, results appear below in list format (existing logic preserved).

## Components to Change

| Component | Action |
|-----------|--------|
| `MainLayout` | Remove (no more sidebar wrapper) |
| `ConditionalLayout` | Simplify or remove |
| `AppSidebar` + subcomponents | Remove, nav moves to Header |
| `Header` | Rewrite: horizontal nav + user dropdown |
| `Footer` | Rewrite: HF-style multi-column links |
| `HomePage` | Add dark Hero section |
| `primitives.css` | Update color values |
| `semantic-light.css` | Update semantic tokens |
| `semantic-dark.css` | Update to deep blue-black dark theme |
| `useSidebarStore` | Keep for mobile Sheet |

## Preserved (No Changes)

- All page functionality and routing structure
- shadcn/ui component library
- Authentication system, state management, API layer
- Admin panel standalone layout
- Account/Workplace page content (entry moves from sidebar to avatar dropdown)
