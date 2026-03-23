# Baidu-Style Search Box Redesign

**Date**: 2026-03-23
**Status**: Implemented

## Overview

Redesign the home page search box from Google-style (inline pill) to Baidu-inspired two-row card layout with right-aligned button, wider container, and logo+title on same line.

## Design Decisions

- **Shape**: Rounded rectangle card (`rounded-2xl`)
- **Button**: Solid brand color (`bg-primary`), right-aligned
- **Icons**: Minimal — only search icon on left, no auxiliary icons
- **Border**: Subtle shadow + border, no gradient line
- **Layout**: Input + button on separate rows, button right-aligned
- **Logo + Title**: Same line (icon 36px + "DimSum AI Labs")

## Logo + Title

- Logo shrunk from 72px to 36px, placed on same line as title
- `flex items-center gap-3` layout
- Subtitle remains on its own line below

## Container

- `max-w-[640px]` (wider than original 580px), `rounded-2xl`, `border`, `bg-background`
- Padding: `px-4 py-3` (compact)
- Default: `shadow-sm hover:shadow-md`
- Focus: `shadow-md ring-1 ring-primary/20`

## Input Row

- Left: `Search` icon (16px, `text-muted-foreground`)
- Input fills remaining width, `text-sm`, no border
- Height: `h-11` (44px, compact)

## Button Row

- Right-aligned (`justify-end`), spacing `mt-2.5`
- Uses existing `Button` component
- Size: `h-9 px-6 rounded-lg`

## Dropdown Suggestions

- Container bottom corners flatten when open
- Suggestions panel uses `rounded-b-2xl`
- Padding `px-4` matches container

## File modified

- `main/app/[locale]/(home)/page.tsx`
