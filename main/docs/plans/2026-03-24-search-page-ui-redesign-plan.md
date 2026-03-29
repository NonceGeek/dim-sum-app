# Search Page UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the search results page to match Google/Baidu patterns — unified header with nav/user, snippet-first result cards with keyword highlighting, chip-style related searches, and improved empty state.

**Architecture:** Extract the search page's inline header into a new `SearchHeader` component that incorporates navigation and user auth (mirroring `FloatingNav` but as a full-width sticky bar). Update `SearchResultItem` for snippet-first display with keyword highlighting. All other changes are confined to `search/page.tsx`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, lucide-react, next-auth, next-intl, zustand (`useAuthStore`)

---

### Task 1: Create `SearchHeader` component

**Files:**
- Create: `components/layout/search-header.tsx`
- Reference: `components/layout/floating-nav.tsx` (copy nav/user logic from here)

**Step 1: Create the file with imports and props interface**

```tsx
"use client";

import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { Search, X, SlidersHorizontal, Menu, ChevronDown, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "@/i18n/navigation";
import { useSession } from "next-auth/react";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { LoginDialog } from "@/components/dialogs/login-dialog";
import { RoleSelectDialog, UserRole } from "@/components/dialogs/role-select-dialog";
import { getAccountSubmenuItems, workplaceSubmenuItems } from "./sidebar/menu-config";
import { Role } from "@prisma/client";
import { cn } from "@/lib/utils";

interface Category {
  id: string | number;
  name: string;
  nickname?: string;
  if_in_all_data?: boolean;
}

interface SearchHeaderProps {
  searchPrompt: string;
  onSearchPromptChange: (value: string) => void;
  onSearch: () => void;
  isPending: boolean;
  selectedDataset: string[];
  onDatasetChange: (dataset: string[]) => void;
  categories: Category[];
  searchPlaceholder: string;
  searchButtonLabel: string;
  searchingLabel: string;
}
```

**Step 2: Add the nav links constant and component body**

```tsx
const navLinks = [
  { labelKey: "library", href: "/library" },
  { labelKey: "appStore", href: "/appStore" },
  { labelKey: "docs", href: "/docs" },
];

const mobileNavLinks = [
  { labelKey: "home", href: "/" },
  { labelKey: "library", href: "/library" },
  { labelKey: "appStore", href: "/appStore" },
  { labelKey: "docs", href: "/docs" },
];

export function SearchHeader({
  searchPrompt,
  onSearchPromptChange,
  onSearch,
  isPending,
  selectedDataset,
  onDatasetChange,
  categories,
  searchPlaceholder,
  searchButtonLabel,
  searchingLabel,
}: SearchHeaderProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { user, isAuthenticated, clearUser } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [showRoleSelect, setShowRoleSelect] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const t = useTranslations("Nav");
  const tCommon = useTranslations("Common");
  const tSearch = useTranslations("Search");

  const accountSubmenuItems = getAccountSubmenuItems(user?.role as Role);

  const handleLogout = async () => {
    await signOut({ redirect: false });
    clearUser();
    router.push("/");
  };

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setShowLoginDialog(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSearch();
  };

  const toggleDataset = (name: string) => {
    if (name === "all") {
      onDatasetChange(["all"]);
      return;
    }
    onDatasetChange(
      (selectedDataset.includes(name)
        ? selectedDataset.filter((d) => d !== name)
        : [...selectedDataset, name]
      ).filter((d) => d !== "all")
    );
  };

  const activeDatasetCount = selectedDataset.includes("all") ? 0 : selectedDataset.length;

  return (
    <>
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="container mx-auto px-4 max-w-6xl h-14 flex items-center gap-2">

          {/* Logo */}
          <Link href="/" className="shrink-0 mr-1">
            <Image src="/logo.png" alt="DimSum AI Labs" width={28} height={28} />
          </Link>

          {/* Search input */}
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={searchPlaceholder}
              value={searchPrompt}
              onChange={(e) => onSearchPromptChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9 pr-8 h-9 text-sm"
            />
            {searchPrompt && (
              <button
                onClick={() => onSearchPromptChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Dataset selector */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="relative shrink-0 px-2">
                <SlidersHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline ml-1.5 text-sm text-muted-foreground max-w-[100px] truncate">
                  {selectedDataset.includes("all")
                    ? tSearch("selectDataset")
                    : categories
                        .filter((c) => selectedDataset.includes(c.name))
                        .map((c) => c.nickname ?? c.name)
                        .join(", ")}
                </span>
                {activeDatasetCount > 0 && (
                  <Badge variant="secondary" className="sm:hidden ml-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
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
                        className="mr-2"
                        checked={selectedDataset.includes(cat.name)}
                        onChange={() => toggleDataset(cat.name)}
                        id={cat.id + ""}
                      />
                      {cat.nickname ?? cat.name}
                    </CommandItem>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Search button */}
          <Button
            onClick={onSearch}
            disabled={isPending}
            size="sm"
            className="shrink-0"
          >
            {isPending ? searchingLabel : searchButtonLabel}
          </Button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t(link.labelKey)}
              </Link>
            ))}
          </div>

          {/* Locale + Theme */}
          <LocaleSwitcher />
          <ThemeToggle />

          {/* User menu / Sign In */}
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={user?.avatar || ""} alt={user?.name || ""} />
                    <AvatarFallback className="text-xs">
                      {user?.name?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm">{user?.name || "User"}</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {accountSubmenuItems.map((item) => (
                  <DropdownMenuItem key={item.href} onClick={() => router.push(item.href)}>
                    <item.icon className="mr-2 h-4 w-4" />
                    {t(item.labelKey)}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                {workplaceSubmenuItems.map((item) => (
                  <DropdownMenuItem key={item.href} onClick={() => router.push(item.href)}>
                    <item.icon className="mr-2 h-4 w-4" />
                    {t(item.labelKey)}
                  </DropdownMenuItem>
                ))}
                {session?.user?.isSystemAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => window.open('/admin', '_blank')}>
                      <Settings className="mr-2 h-4 w-4" />
                      {t('admin')}
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {tCommon('signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="default" size="sm" onClick={() => setShowRoleSelect(true)}>
              {tCommon('signIn')}
            </Button>
          )}

          {/* Mobile hamburger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden h-8 w-8">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 p-0">
              <div className="flex flex-col h-full">
                <div className="flex h-14 items-center border-b px-4">
                  <Image src="/logo.png" alt="DimSum AI Labs Logo" width={24} height={24} className="rounded-sm" />
                  <span className="ml-2 text-sm font-medium">DimSum AI</span>
                </div>
                <nav className="flex-1 overflow-auto py-4 px-3 space-y-1">
                  {mobileNavLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                    >
                      {t(link.labelKey)}
                    </Link>
                  ))}
                  {session?.user?.isSystemAdmin && (
                    <Link
                      href="/admin"
                      target="_blank"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      {t('admin')}
                    </Link>
                  )}
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <RoleSelectDialog
        isOpen={showRoleSelect}
        onClose={() => setShowRoleSelect(false)}
        onConfirm={handleRoleSelect}
      />
      {selectedRole && (
        <LoginDialog
          isOpen={showLoginDialog}
          onClose={() => {
            setShowLoginDialog(false);
            setSelectedRole(null);
          }}
          callbackUrl={`/?role=${selectedRole}`}
          role={selectedRole}
        />
      )}
    </>
  );
}
```

**Step 3: Run dev server and verify**

```bash
pnpm dev
```

Open `http://localhost:3000/search?q=姐姐` in browser. The file is created but not yet used — no visual change expected yet. Check that TypeScript compiles without errors:

```bash
pnpm tsc --noEmit
```

Expected: no errors in the new file.

**Step 4: Commit**

```bash
git add components/layout/search-header.tsx
git commit -m "feat(search): add SearchHeader component with nav + user auth"
```

---

### Task 2: Wire `SearchHeader` into the search page

**Files:**
- Modify: `app/[locale]/(home)/search/page.tsx`

**Step 1: Replace the inline `<header>` block with `<SearchHeader>`**

At the top of the file, add the import:
```tsx
import { SearchHeader } from "@/components/layout/search-header";
```

Remove the `Input`, `Popover`, `PopoverContent`, `PopoverTrigger`, `Command`, `CommandInput`, `CommandItem`, `CommandList`, `Checkbox`, `ChevronDown` imports that are no longer needed in this file (they moved to `SearchHeader`). Keep `Search`, `SearchX`.

Also remove the `inputValue` / `setInputValue` state — it's now internal to `SearchHeader`.

**Step 2: Replace the `<header>` JSX (lines 201–304) with:**

```tsx
<SearchHeader
  searchPrompt={searchPrompt}
  onSearchPromptChange={setSearchPrompt}
  onSearch={handleSearch}
  isPending={isPending}
  selectedDataset={selectedDataset}
  onDatasetChange={setSelectedDataset}
  categories={fiter_not_in}
  searchPlaceholder={th("searchPlaceholder")}
  searchButtonLabel={th("searchButton")}
  searchingLabel={t("searching")}
/>
```

**Step 3: Verify in browser**

Visit `http://localhost:3000/search?q=姐姐`.

Check:
- Header shows: logo | search input with ✕ | dataset selector | Search button | Library AppStore Docs | locale | theme | user/sign-in
- ✕ button appears when there is text in the input, clears on click
- Clicking Library/AppStore/Docs navigates correctly
- User dropdown works (sign in / sign out)
- Mobile: hamburger opens Sheet with nav links
- Dataset popover still works (filtering results)

**Step 4: Commit**

```bash
git add app/[locale]/\(home\)/search/page.tsx
git commit -m "feat(search): replace inline header with SearchHeader"
```

---

### Task 3: Update `SearchResultItem` — breadcrumb + snippet-first + keyword highlight

**Files:**
- Modify: `app/[locale]/(home)/_components/search-result-item.tsx`
- Modify: `app/[locale]/(home)/search/page.tsx` (pass `keyword` prop)

**Step 1: Add `highlightKeyword` helper to `search-result-item.tsx`**

Add after the existing helpers (after the `hasRichContent` function):

```tsx
function highlightKeyword(text: string, keyword: string): React.ReactNode {
  if (!keyword.trim()) return text;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === keyword.toLowerCase() ? (
      <strong key={i} className="font-semibold text-foreground">
        {part}
      </strong>
    ) : (
      part
    )
  );
}
```

**Step 2: Add `keyword` prop to `SearchResultItem`**

Change the component signature from:
```tsx
export default function SearchResultItem({
  result,
  setEditingResult,
  setUpdateDialogOpen,
}: {
  result: SearchResult;
  setEditingResult: React.Dispatch<React.SetStateAction<SearchResult | null>>;
  setUpdateDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
})
```

To:
```tsx
export default function SearchResultItem({
  result,
  setEditingResult,
  setUpdateDialogOpen,
  keyword = "",
}: {
  result: SearchResult;
  setEditingResult: React.Dispatch<React.SetStateAction<SearchResult | null>>;
  setUpdateDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  keyword?: string;
})
```

**Step 3: Update the Song variant (粤语曲库) — add breadcrumb above title**

Find the `// YueSong variant` return block. Replace:
```tsx
<h3 className="text-lg font-semibold text-primary leading-snug">
  {songNote.context.song_name}
</h3>
```

With:
```tsx
<p className="text-xs text-muted-foreground mb-0.5">{result.category}</p>
<h3 className="text-lg font-semibold text-primary leading-snug">
  {songNote.context.song_name}
</h3>
```

**Step 4: Update the default variant — breadcrumb above title, snippet always visible, conditional expand**

Replace the entire `// WordLyric / default variant` return block:

```tsx
// WordLyric / default variant
const isRichMedia =
  hasRichContent(result.note) &&
  (() => {
    const n = result.note as unknown;
    if (typeof n === "string") return isImageUrl(n) || isAudioByExt(n);
    if (Array.isArray(n))
      return (n as unknown[]).some(
        (i) => typeof i === "string" && (isImageUrl(i) || isAudioByExt(i))
      );
    if (typeof n === "object" && "context" in (n as object)) {
      const ctx = (n as { context: Record<string, unknown> }).context;
      return !!(ctx.video || Object.values(ctx).some(
        (v) => typeof v === "string" && (isAudioByExt(v) || isImageUrl(v))
      ));
    }
    return false;
  })();

return (
  <div className="py-5 border-b border-border last:border-0">
    {/* Breadcrumb */}
    <p className="text-xs text-muted-foreground mb-0.5">{result.category}</p>

    <div className="flex justify-between items-start gap-4">
      <h3 className="text-lg font-semibold text-primary leading-snug flex-1 min-w-0">
        {result.data}
      </h3>
      <div className="flex items-center gap-1 shrink-0">
        {isRichMedia && (
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="text-muted-foreground hover:text-foreground"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                {t("collapseContent")}
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                {t("expandContent")}
              </>
            )}
          </Button>
        )}
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditingResult(result);
              setUpdateDialogOpen(true);
            }}
          >
            {tc("edit")}
          </Button>
        )}
      </div>
    </div>

    {/* Snippet — always visible */}
    {snippet && !expanded && (
      <p className="text-sm text-foreground mt-1.5 line-clamp-3 leading-relaxed">
        {highlightKeyword(snippet, keyword)}
      </p>
    )}

    {/* Rich media expanded content */}
    <AnimatePresence initial={false}>
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          <div className="mt-3 bg-muted/40 rounded-md p-4 space-y-3">
            <NoteContent result={result} />
            {related && (
              <div className="space-y-2 pt-1 border-t border-border">
                {related?.apps?.length > 0 && (
                  <RelatedLinks
                    title={t("relatedApps")}
                    links={related.apps}
                    uniqueId={result.unique_id}
                  />
                )}
                {related?.links?.length > 0 && (
                  <RelatedLinks
                    title={t("relatedLinks")}
                    links={related.links}
                    uniqueId={result.unique_id}
                  />
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Tags */}
    <div className="flex flex-wrap gap-1.5 mt-2.5">
      {result.tags.map((tag, idx) => (
        <span
          key={idx}
          className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded border border-border"
        >
          {tag}
        </span>
      ))}
    </div>
  </div>
);
```

Note: the category badge at the bottom has been removed (replaced by the breadcrumb at the top). Only `result.tags` remain as chips.

**Step 5: Pass `keyword` prop in `search/page.tsx`**

Find the `<SearchResultItem>` usage in `search/page.tsx`:
```tsx
<SearchResultItem
  result={result}
  setEditingResult={setEditingResult}
  setUpdateDialogOpen={setUpdateDialogOpen}
/>
```

Change to:
```tsx
<SearchResultItem
  result={result}
  setEditingResult={setEditingResult}
  setUpdateDialogOpen={setUpdateDialogOpen}
  keyword={searchPrompt}
/>
```

**Step 6: Verify in browser**

Visit `http://localhost:3000/search?q=姐姐`.

Check:
- Each result shows `粤语词库` / `广州话正音字典` etc. in muted small text above the title
- Snippet is visible immediately without clicking
- "姐姐" is bolded in snippet text where it appears
- "展开内容" button only appears on results that have video/audio/images
- Plain text results have no expand button
- Song results (粤语曲库) show breadcrumb above song name

**Step 7: Commit**

```bash
git add app/[locale]/\(home\)/_components/search-result-item.tsx
git add app/[locale]/\(home\)/search/page.tsx
git commit -m "feat(search): breadcrumb above title, snippet-first, keyword highlight"
```

---

### Task 4: Update pagination styling

**Files:**
- Modify: `app/[locale]/(home)/search/page.tsx`

**Step 1: Add `ChevronLeft` to the lucide imports**

Find the existing lucide import at the top of `search/page.tsx`:
```tsx
import { Search, SearchX } from "lucide-react";
```
Change to:
```tsx
import { Search, SearchX, ChevronLeft, ChevronRight } from "lucide-react";
```

**Step 2: Update the Prev button**

Find:
```tsx
<button
  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
  disabled={currentPage === 1}
  className="px-3 py-1.5 rounded text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
>
  {t("prevPage")}
</button>
```

Replace with:
```tsx
<button
  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
  disabled={currentPage === 1}
  className="flex items-center gap-1 px-3 py-1.5 rounded text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
>
  <ChevronLeft className="h-4 w-4" />
  {t("prevPage")}
</button>
```

**Step 3: Update the Next button**

Find:
```tsx
<button
  onClick={() =>
    setCurrentPage((p) => Math.min(totalPages, p + 1))
  }
  disabled={currentPage === totalPages}
  className="px-3 py-1.5 rounded text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
>
  {t("nextPage")}
</button>
```

Replace with:
```tsx
<button
  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
  disabled={currentPage === totalPages}
  className="flex items-center gap-1 px-3 py-1.5 rounded text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
>
  {t("nextPage")}
  <ChevronRight className="h-4 w-4" />
</button>
```

**Step 4: Update the active page button style**

Find:
```tsx
currentPage === page
  ? "font-bold text-primary"
  : "text-muted-foreground hover:bg-muted"
```

Replace with:
```tsx
currentPage === page
  ? "bg-primary text-primary-foreground rounded-full font-medium min-w-[32px] text-center"
  : "text-muted-foreground hover:bg-muted"
```

**Step 5: Verify in browser**

Search for something with many results. Check:
- Prev/Next buttons have arrow icons
- Active page has filled pill background

**Step 6: Commit**

```bash
git add app/[locale]/\(home\)/search/page.tsx
git commit -m "feat(search): improve pagination with icons and active pill style"
```

---

### Task 5: Replace related searches with chip grid

**Files:**
- Modify: `app/[locale]/(home)/search/page.tsx`
- Modify: `messages/zh-CN.json` and `messages/en.json` (add `relatedSearches` key)

**Step 1: Add i18n key**

In `messages/zh-CN.json`, find the `"Search"` section and add after `"allCategories"`:
```json
"relatedSearches": "相关搜索"
```

In `messages/en.json`, find the `"Search"` section and add:
```json
"relatedSearches": "Related searches"
```

**Step 2: Replace the "Try other searches" section in the results area**

In `search/page.tsx`, find the `{/* ── Try other searches ──*/}` block (inside the `results && results.length > 0` section):

```tsx
<div className="mt-10 pt-6 border-t border-border">
  <p className="text-sm text-muted-foreground mb-3">{t("tryOtherSearches")}</p>
  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
    {[...].map(...)}
  </div>
</div>
```

Replace with:
```tsx
<div className="mt-10 pt-6 border-t border-border">
  <p className="text-sm text-muted-foreground mb-3">{t("relatedSearches")}</p>
  <div className="flex flex-wrap gap-2">
    {[
      { title: t("exampleLyrics"), prompt: "落花流水" },
      { title: t("exampleWords"), prompt: "姐姐" },
      { title: t("exampleCharacter"), prompt: "行" },
      { title: t("exampleVideo"), prompt: "歡聚一堂" },
    ]
      .filter((e) => e.prompt !== searchPrompt)
      .map((example) => (
        <button
          key={example.prompt}
          onClick={() => {
            if (isPending) return;
            setResults(null);
            handleExampleSearch(example.prompt);
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-accent transition-colors"
        >
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          {example.title}「{example.prompt}」
        </button>
      ))}
  </div>
</div>
```

**Step 3: Verify in browser**

After a search with results, scroll to the bottom. Related searches should appear as bordered chip buttons with a small search icon.

**Step 4: Commit**

```bash
git add app/[locale]/\(home\)/search/page.tsx messages/zh-CN.json messages/en.json
git commit -m "feat(search): replace related searches with chip grid"
```

---

### Task 6: Improve no-results empty state

**Files:**
- Modify: `app/[locale]/(home)/search/page.tsx`
- Modify: `messages/zh-CN.json` and `messages/en.json`

**Step 1: Add i18n keys**

In `messages/zh-CN.json`, `"Search"` section, add:
```json
"noResultsTip1": "检查输入是否有误",
"noResultsTip2": "尝试更简短的关键词"
```

In `messages/en.json`, `"Search"` section, add:
```json
"noResultsTip1": "Check for typos or spelling errors",
"noResultsTip2": "Try a shorter or simpler keyword"
```

**Step 2: Replace the no-results section**

Find the `{/* ── No results ──*/}` block and replace the entire JSX:

```tsx
{results && results.length === 0 && (
  <div className="container mx-auto px-4 py-16 max-w-4xl">
    <div className="flex flex-col items-center text-center gap-4">
      <SearchX className="h-10 w-10 text-muted-foreground" />
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold text-foreground">
          {t("noResultsTitle")}
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {t("noResultsDesc", { query: searchPrompt })}
        </p>
      </div>

      {/* Suggestions */}
      <ul className="text-sm text-muted-foreground text-left space-y-1 mt-1">
        <li>• {t("noResultsTip1")}</li>
        <li>• {t("noResultsTip2")}</li>
      </ul>

      {/* Related search chips */}
      <div className="mt-2">
        <p className="text-sm text-muted-foreground mb-3">{t("relatedSearches")}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {[
            { title: t("exampleLyrics"), prompt: "落花流水" },
            { title: t("exampleWords"), prompt: "姐姐" },
            { title: t("exampleCharacter"), prompt: "行" },
            { title: t("exampleVideo"), prompt: "歡聚一堂" },
          ]
            .filter((e) => e.prompt !== searchPrompt)
            .map((example) => (
              <button
                key={example.prompt}
                onClick={() => {
                  if (isPending) return;
                  setResults(null);
                  handleExampleSearch(example.prompt);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-accent transition-colors"
              >
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                {example.title}「{example.prompt}」
              </button>
            ))}
        </div>
      </div>
    </div>
  </div>
)}
```

**Step 3: Verify in browser**

Search for a nonsense string like `xyzabc123`. Check:
- Empty state shows icon, title, description
- Two bullet-point suggestions appear
- Search chip buttons appear below with bordered style

**Step 4: Commit**

```bash
git add app/[locale]/\(home\)/search/page.tsx messages/zh-CN.json messages/en.json
git commit -m "feat(search): improve no-results empty state with tips and chips"
```

---

### Task 7: Final verification

**Step 1: Full build check**

```bash
pnpm build
```

Expected: no TypeScript errors, no build failures.

**Step 2: Browser smoke test checklist**

Visit `http://localhost:3000/search?q=姐姐` and verify:

- [ ] Header: logo + search input + ✕ + dataset + Search + Library/AppStore/Docs + locale + theme + user
- [ ] Mobile: hamburger opens Sheet with nav links
- [ ] Category tabs visible when multiple datasets selected
- [ ] Each result: breadcrumb (muted) above title, snippet visible, keyword bolded
- [ ] "展开内容" only on video/audio/image results
- [ ] Pagination: ← Prev and Next → with arrow icons, active page has pill
- [ ] Related searches: chip buttons with search icon
- [ ] No-results: tips + chips (test with `xyzabc123`)

**Step 3: Final commit if any cleanup needed**

```bash
git add -p
git commit -m "chore(search): cleanup and final polish"
```
