# Search Header Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the search box the visual centerpiece of the search results header by embedding the dataset selector inside the input, removing the spacer, and demoting nav links.

**Architecture:** All changes are confined to a single component file `components/layout/search-header.tsx`. The search input wrapper becomes `flex-1` (no max-width cap), the dataset `<Popover>` trigger moves inside the input box on the right side separated by a vertical divider, and the spacer div is removed so the right-side nav/user controls sit naturally after the search area.

**Tech Stack:** Next.js 14, Tailwind CSS, shadcn/ui (Popover, Command, Input, Button)

---

### Task 1: Remove max-w-xl and spacer, flex-1 the search wrapper

**Files:**
- Modify: `components/layout/search-header.tsx:161-183` (search input wrapper)
- Modify: `components/layout/search-header.tsx:244` (spacer div)

**Step 1: Remove `max-w-xl` from search wrapper and remove spacer**

Find and update the search input wrapper (line ~161):
```tsx
// BEFORE
<div className="relative flex-1 max-w-xl">

// AFTER
<div className="relative flex-1">
```

Find and remove the spacer div (line ~244):
```tsx
// REMOVE this entire line:
<div className="flex-1" />
```

**Step 2: Verify in browser**

Run: `pnpm dev` and navigate to `/search?q=好`

Expected: Search input stretches to fill available space between logo and right-side controls. Nav links and user menu are now immediately after the Search button with no gap.

**Step 3: Commit**
```bash
git add components/layout/search-header.tsx
git commit -m "refactor(search-header): remove max-w-xl cap and spacer from search input"
```

---

### Task 2: Move dataset selector inside the search box

**Files:**
- Modify: `components/layout/search-header.tsx:160-231`

**Step 1: Restructure the search input wrapper to include dataset popover**

Replace the current search input div + standalone Popover block with the following combined structure:

```tsx
{/* Search input — dataset selector embedded on right */}
<div className="relative flex-1 flex items-center rounded-md border border-input bg-background shadow-sm ring-offset-background transition-all hover:ring-1 hover:ring-primary/40 focus-within:ring-1 focus-within:ring-primary/50 dark:bg-background">
  {/* Search icon */}
  <div className="pl-3 flex items-center pointer-events-none shrink-0">
    <Search className="h-4 w-4 text-muted-foreground" />
  </div>

  {/* Text input */}
  <input
    type="text"
    placeholder={searchPlaceholder}
    value={searchPrompt}
    onChange={(e) => onSearchPromptChange(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Enter") onSearch();
    }}
    className="flex-1 min-w-0 h-9 px-2 bg-transparent text-sm outline-none placeholder:text-muted-foreground dark:text-accent-foreground dark:placeholder:text-accent-foreground"
  />

  {/* Divider + dataset selector + clear button */}
  <div className="flex items-center shrink-0 pr-1">
    <div className="w-px h-4 bg-border mx-1" />
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2 relative"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="hidden sm:inline truncate max-w-[80px]">
            {datasetLabel || tSearch("selectDataset")}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0" />
          {activeDatasetCount > 0 && (
            <Badge className="sm:hidden absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center">
              {activeDatasetCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command className="bg-background!">
          <CommandInput
            placeholder={tSearch("searchDatasetPlaceholder")}
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            {categories.map((cat) => (
              <CommandItem
                key={cat.id}
                value={cat.nickname ?? cat.name}
                onSelect={() => toggleDataset(cat.name)}
              >
                <Checkbox
                  className="mr-2 dark:bg-accent-background"
                  checked={selectedDataset.includes(cat.name)}
                  onChange={() => toggleDataset(cat.name)}
                  id={`dataset-${cat.id}`}
                />
                {cat.nickname ?? cat.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>

    {searchPrompt && (
      <button
        type="button"
        onClick={() => onSearchPromptChange("")}
        className="flex items-center justify-center h-7 w-7 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    )}
  </div>
</div>
```

Also **delete** the old standalone `<Popover>` block (lines ~186–231) — it's now fully inside the wrapper above.

Note: We're using a plain `<input>` instead of shadcn `<Input>` to avoid double border. The outer `div` provides the border/ring/shadow.

**Step 2: Verify in browser**

Expected: Search box fills the center of the header. Inside it: left has 🔍 + text, right has `|` divider + 全局搜索 ▾ + ✕ (when text present). Clicking 全局搜索 ▾ opens the dataset popover. The ring appears on focus/hover.

**Step 3: Commit**
```bash
git add components/layout/search-header.tsx
git commit -m "feat(search-header): embed dataset selector inside search box with divider"
```

---

### Task 3: Demote desktop nav link styles

**Files:**
- Modify: `components/layout/search-header.tsx:247-257`

**Step 1: Update nav links container and link classes**

```tsx
// BEFORE
<div className="hidden md:flex items-center gap-4">
  {navLinks.map((link) => (
    <Link
      ...
      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
    >

// AFTER
<div className="hidden md:flex items-center gap-3">
  {navLinks.map((link) => (
    <Link
      ...
      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
```

**Step 2: Verify in browser**

Expected: Library / App Store / Docs links are visibly smaller, creating a clear visual hierarchy — search is primary, nav is secondary.

**Step 3: Commit**
```bash
git add components/layout/search-header.tsx
git commit -m "style(search-header): demote desktop nav links to text-xs for visual hierarchy"
```

---

### Task 4: Final review

**Step 1: Check all states visually**
- Empty search box: no ✕ button visible
- With text: ✕ appears inside box on the right
- With dataset selected: label shows inside box (e.g. "粤语万句…")
- Hover search box: ring-primary/40 appears
- Focus search box: ring-primary/50 appears
- Mobile: dataset label hidden (sm:hidden), badge shows count if active
- Dark mode: text and background render correctly

**Step 2: Check for TypeScript errors**
```bash
pnpm tsc --noEmit
```
Expected: No errors.
