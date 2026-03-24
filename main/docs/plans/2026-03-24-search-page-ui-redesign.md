# Search Page UI Redesign

**Date:** 2026-03-24
**Scope:** `/app/[locale]/(home)/search/page.tsx` + related components
**Goal:** Align search results page UX with Google/Baidu patterns for fast word/lyric lookup

---

## 1. Header — Unified Inline Navigation

**Problem:** Search page has its own sticky header but lacks navigation links and user auth. `FloatingNav` (floating fixed top-right) is used on homepage but conflicts with the search page's own header. Users lose access to Library/AppStore/Docs nav and user menu on the search page.

**Solution:** Create a new `SearchHeader` component that replaces both the current search header and avoids loading `FloatingNav` on the search page.

### Layout

**Desktop (h-14):**
```
[🍜 Logo] [🔍 Search input ──── ✕] [Dataset▾] [Search]   Library  AppStore  Docs  [🌍] [🌙] [Avatar▾]
```

**Mobile (h-14):**
```
[🍜 Logo] [🔍 Search input ── ✕] [Search]   [Avatar/Login] [☰]
```
Mobile hamburger opens a Sheet with nav links (reusing existing Sheet pattern from `FloatingNav`).

### Details
- Search input: add `✕` clear button (only visible when input has value)
- Dataset selector: always visible — icon-only (`SlidersHorizontal`) with count badge on mobile, label text on desktop (`hidden sm:flex` → always shown)
- Nav links: Library, AppStore, Docs — `hidden md:flex`
- Right side: `LocaleSwitcher` + `ThemeToggle` + user dropdown (authenticated) or Sign In button
- User dropdown: reuse same items as `FloatingNav` (`accountSubmenuItems`, `workplaceSubmenuItems`, admin link, sign out)
- Auth dialogs: `RoleSelectDialog` + `LoginDialog` included in `SearchHeader`
- **Do not render `FloatingNav` on the search page** — `SearchHeader` replaces it entirely

### New file
`components/layout/search-header.tsx`

---

## 2. Search Result Item — Google-style Card

**Problem:** Category badge is at the bottom (scanned last), snippet is hidden behind expand button by default, no keyword highlighting.

**Solution:** Restructure each result card to match Google's visual hierarchy.

### New card structure
```
{category} › {subcategory}          ← breadcrumb, muted small text (top)
Title                         [Edit]
Snippet with **keyword** bold highlight, line-clamp-3 by default
[tag1] [tag2]
[Show details ▾]              ← only for rich content (video/audio/image)
```

### Details
- **Breadcrumb:** `{result.category}` in muted small text above title, replacing the bottom badge. Keep tags (`result.tags`) below the snippet as chips.
- **Snippet always visible:** Remove the collapsed-by-default behavior for plain text content. `line-clamp-3` shown immediately.
- **Keyword highlight:** Pass `searchPrompt` down to `SearchResultItem`. In `getSnippet()` result, wrap occurrences of the keyword with `<mark className="bg-transparent font-semibold text-foreground not-italic">`. Use a simple `highlightKeyword(text, keyword)` helper.
- **Expand button:** Only rendered when `hasRichContent` returns true AND the rich content is non-text (video, audio, image, iframe). Plain text notes don't need expand.
- **Song cards (`粤语曲库`):** Add breadcrumb above title, keep play/share buttons. No other changes.

### Files changed
- `app/[locale]/(home)/_components/search-result-item.tsx`
- `app/[locale]/(home)/search/page.tsx` (pass `searchPrompt` as prop to `SearchResultItem`)

---

## 3. Pagination — Minor Polish

**Problem:** Active page is hard to distinguish (only bold + color, no background).

**Solution:**
- Active page button: add `bg-primary text-primary-foreground rounded-full` pill style
- Prev/Next buttons: add `←` / `→` icons (`ChevronLeft` / `ChevronRight` from lucide)
- No structural changes

### Files changed
- `app/[locale]/(home)/search/page.tsx` (pagination buttons)

---

## 4. Related Searches — Chip Grid

**Problem:** Related searches are plain text links, low visual affordance.

**Solution:** Google-style chip grid with search icon.

### New layout
```
相关搜索
[🔍 落花流水]  [🔍 姐姐]  [🔍 行]  [🔍 歡聚一堂]
```
- Each chip: `border rounded-lg px-4 py-2 flex items-center gap-2 text-sm hover:bg-accent`
- Section heading: `text-sm text-muted-foreground mb-3`
- Chips replace the current plain `<button className="text-primary hover:underline">` pattern
- Same data source and click handler, only visual change

### Files changed
- `app/[locale]/(home)/search/page.tsx` (related searches section, both in results and no-results)

---

## 5. No Results Page — Structured Empty State

**Problem:** No results state shows only icon + text. No guidance or suggestions.

**Solution:** Structured empty state with suggestions list and search chips.

### New layout
```
        [SearchX icon]
   未找到「{query}」的相关结果

   建议：
   • 检查输入是否有误
   • 尝试更简短的关键词

   你也可以搜索：
   [🔍 落花流水]  [🔍 姐姐]  [🔍 行]
```
- Suggestions list: static `<ul>` with bullet points, muted text
- Search chips: same component as related searches above
- i18n keys needed: `noResultsTip1`, `noResultsTip2`

### Files changed
- `app/[locale]/(home)/search/page.tsx` (no results section)

---

## Summary of Files

| File | Change |
|------|--------|
| `components/layout/search-header.tsx` | **New** — unified header replacing FloatingNav on search page |
| `app/[locale]/(home)/search/page.tsx` | Use `SearchHeader`, pass `searchPrompt` to results, update pagination/related/no-results |
| `app/[locale]/(home)/_components/search-result-item.tsx` | Breadcrumb above title, snippet always visible, keyword highlight, conditional expand |

---

## Out of Scope
- Search suggestions/autocomplete (homepage already has this, not needed on results page)
- Infinite scroll (user confirmed: keep pagination)
- Result ranking or relevance changes (backend concern)
