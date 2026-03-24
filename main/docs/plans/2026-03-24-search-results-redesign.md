# Search Results Page Redesign

**Date:** 2026-03-24
**Status:** Approved
**Scope:** `app/[locale]/(home)/search/` + `_components/`

---

## Goal

Redesign the search results page from a card-list layout into a Google/Baidu-style flat search results page — professional, clean, high information density — while conforming to the existing design system tokens.

---

## Approved Design Decisions

| Dimension | Decision |
|---|---|
| Layout style | Baidu style: sticky top search bar + horizontal category tabs + vertical flat list |
| Result card style | Flat / plain — `border-b` dividers, no card shadows |
| Rich media | Collapsed by default, expand on click with `AnimatePresence` |
| Mobile | Category tabs horizontally scrollable |

---

## Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ sticky header: [Logo] [Search Input] [Dataset▼] [搜索]   │  h-14, border-b
├─────────────────────────────────────────────────────────┤
│ category tabs: 全部(128)  词典(45)  歌词(38)  ...          │  border-b, scrollable
├─────────────────────────────────────────────────────────┤
│ result count: 找到约 128 条结果                            │  text-sm muted
│                                                          │
│ [SearchResultItem] × N                                   │  py-5, border-b
│                                                          │
│ pagination: 上一页  1  2  3  ...  26  下一页               │  text-style, centered
└─────────────────────────────────────────────────────────┘
```

---

## Components

### Files to create

#### `_components/category-tabs.tsx`

Replaces `CategorySelector`. Renders a horizontal scrollable tab bar.

- Props: `{ categories, selectedCategory, onSelect, totalCount }`
- Active tab: `border-b-2 border-primary text-primary font-medium`
- Inactive tab: `text-muted-foreground hover:text-foreground`
- Count shown in parentheses: `(45)`
- Only renders when `selectedDataset` is `all` or multiple datasets selected (same condition as current `CategorySelector`)
- Mobile: `overflow-x-auto` with hidden scrollbar

#### `_components/search-result-item.tsx`

Replaces both `WordLyricCardDetail` and `YueSongCardDetail`. Single component that handles both result types.

**WordLyric variant (all categories except 粤语曲库):**
```
[Title — text-lg font-semibold text-primary]
[Snippet — text-sm text-foreground line-clamp-3]
[CategoryBadge] [tag1] [tag2]          [展开内容↓] [编辑]
──────────────────────────────────────────────────────
▼ Expanded (AnimatePresence):
  bg-muted/40 rounded-md p-4
  Detailed fields (meaning, pinyin, page, etc.)
  Related apps / links
```

**YueSong variant (category === 粤语曲库):**
```
[Song Title — text-lg font-semibold text-primary]  [▶播放] [🔗分享]
[Author / Album — text-sm text-muted-foreground]
[Introduction — text-sm line-clamp-2]
[粤语曲库 badge]
──────────────────────────────────────────────────────
```

**Shared token usage:**
- Container: `py-5 border-b border-border`
- Badges: `text-xs px-2 py-0.5 bg-primary/10 text-primary rounded`
- Tags: `text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded border border-border`
- Action buttons: `variant="ghost" size="sm"`
- Expand animation: `motion.div` with `initial={{ height: 0 }} animate={{ height: "auto" }}`

### Files to modify

#### `search/page.tsx`

Structural changes only — business logic (state, search, pagination) stays intact.

1. **Remove** the gradient banner section (`py-6 bg-gradient-to-r ...`)
2. **Add** sticky header bar (`sticky top-0 z-50 bg-background border-b h-14`)
   - Logo: `点心探索` text link → `/`, `font-bold text-primary`
   - Search input: `h-9 text-sm` (compact)
   - Dataset popover: keep existing logic, change trigger to `variant="ghost" size="sm"` with `ChevronDown`
   - Search button: `h-9`
3. **Replace** `<CategorySelector>` with `<CategoryTabs>`
4. **Add** result count line: `找到约 {results.length} 条结果`
5. **Replace** `<WordLyricCardDetail>` and `<YueSongCardDetail>` with `<SearchResultItem>`
6. **Restyle** pagination: keep logic, change to text-style links
7. **Restyle** no-results state: centered icon + text + plain text suggestion links
8. **Restyle** loading skeletons: match flat item dimensions (no card padding)

---

## Pagination Redesign

Current: filled `Button` squares `[<] [1] [2] [3] [>]`

New (Baidu/Google text style):
```
上一页   1   2   3   ...   26   下一页
```
- Each page: `text-sm px-3 py-1 rounded hover:bg-muted`
- Active page: `font-bold text-primary`
- Prev/Next: text labels, disabled = `opacity-40 cursor-not-allowed`

---

## No-Results State

```
         [SearchX icon — h-10 w-10 text-muted-foreground]

         没有找到"xxx"的相关结果

         换个关键词试试？

         落花流水  ·  姐姐  ·  行  ·  歡聚一堂   ← plain text links, text-primary
```

Remove the grid of `Card` tiles — replace with inline `·` separated text links.

---

## Loading Skeletons

Match new flat item dimensions:
- Title skeleton: `h-5 w-2/5`
- Snippet: `h-4 w-full` × 2 lines
- Tags row: `h-5 w-16` × 3
- No card wrapper, just `py-5 border-b`

---

## What Does NOT Change

- All state management logic in `page.tsx`
- Search / pagination / filter logic
- `useSearch`, `useAllCategories` hooks
- `EditCorpusDialog`
- `edit permission` logic inside result items
- `isDictionaryNote` type guard
- i18n translation keys

---

## File Summary

| File | Action |
|---|---|
| `search/page.tsx` | Modify — layout skeleton only |
| `_components/category-tabs.tsx` | Create — replaces CategorySelector |
| `_components/search-result-item.tsx` | Create — replaces WordLyricCardDetail + YueSongCardDetail |
| `_components/category-selector.tsx` | Keep — no change (not used on search page after this) |
| `_components/word-lyric-card-detail.tsx` | Keep — no change (may be used elsewhere) |
| `_components/yue-song-card-detail.tsx` | Keep — no change (may be used elsewhere) |
