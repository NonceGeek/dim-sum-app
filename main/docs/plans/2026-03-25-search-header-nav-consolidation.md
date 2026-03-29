# SearchHeader Nav Consolidation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify the SearchHeader right side to 2 elements (`[☰] [Avatar]`) by moving nav links, language switcher, and theme toggle into a unified hamburger menu — Dropdown on desktop, Sheet on mobile.

**Architecture:** The hamburger button becomes a universal control for all secondary navigation. On `lg+` screens it triggers a `DropdownMenu`; below `lg` it triggers the existing `Sheet`. The header bar itself only renders the hamburger button and the user menu (or Sign In button), leaving maximum space for the search bar.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, shadcn/ui (`DropdownMenu`, `Sheet`), `next-intl`, `next-themes`, lucide-react

---

### Task 1: Extract shared menu content into a helper component

The hamburger menu content is identical between desktop dropdown and mobile sheet. Extract it so there's no duplication.

**Files:**
- Create: `components/layout/hamburger-menu-content.tsx`
- Modify: `components/layout/search-header.tsx`

**Step 1: Create the shared content component**

```tsx
// components/layout/hamburger-menu-content.tsx
"use client";

import { Link } from "@/i18n/navigation";
import { ThemeToggle } from "@/components/theme-toggle/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useTranslations } from "next-intl";

const navLinks = [
  { labelKey: "library", href: "/library" },
  { labelKey: "appStore", href: "/appStore" },
  { labelKey: "docs", href: "/docs" },
];

interface HamburgerMenuContentProps {
  onNavClick?: () => void;
}

export function HamburgerMenuContent({ onNavClick }: HamburgerMenuContentProps) {
  const t = useTranslations("Nav");
  const tCommon = useTranslations("Common");

  return (
    <>
      {navLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          onClick={onNavClick}
          className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        >
          {t(link.labelKey)}
        </Link>
      ))}

      <div className="border-t border-border my-2" />

      <div className="px-3 py-2 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-foreground">
            {tCommon("language")}
          </span>
          <LocaleSwitcher />
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-foreground">
            {tCommon("theme")}
          </span>
          <ThemeToggle />
        </div>
      </div>
    </>
  );
}
```

**Step 2: Verify the file was created correctly**

Open `components/layout/hamburger-menu-content.tsx` and check it imports correctly.

**Step 3: Commit**

```bash
git add components/layout/hamburger-menu-content.tsx
git commit -m "feat: extract HamburgerMenuContent shared component"
```

---

### Task 2: Refactor SearchHeader right side

Remove inline nav links, `LocaleSwitcher`, and `ThemeToggle` from the desktop header bar. Replace with a single hamburger button that opens a `DropdownMenu` on `lg+` and a `Sheet` on smaller screens.

**Files:**
- Modify: `components/layout/search-header.tsx`

**Step 1: Update imports**

Remove `LocaleSwitcher` and `ThemeToggle` imports (they're now only used inside `HamburgerMenuContent`). Add `HamburgerMenuContent`.

```tsx
// Remove these two lines:
import { ThemeToggle } from "@/components/theme-toggle/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";

// Add:
import { HamburgerMenuContent } from "@/components/layout/hamburger-menu-content";
```

**Step 2: Replace the desktop right section (lines 413–491 in the original file)**

Find the comment `{/* Right: Navigation - Push to far right */}` and replace the entire right section with:

```tsx
{/* Right: Hamburger + User */}
<div className="flex items-center gap-2 shrink-0 ml-auto">

  {/* Desktop: Dropdown hamburger (lg+) */}
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="hidden lg:flex h-8 w-8">
        <Menu className="h-5 w-5" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-52 p-2">
      <HamburgerMenuContent />
    </DropdownMenuContent>
  </DropdownMenu>

  {/* Mobile/tablet: Sheet hamburger (below lg) */}
  <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
    <SheetTrigger asChild>
      <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8">
        <Menu className="h-5 w-5" />
      </Button>
    </SheetTrigger>
    <SheetContent side="right" className="w-64 p-0">
      <div className="flex flex-col h-full">
        <div className="flex h-14 items-center border-b px-4">
          <Image
            src="/logo.png"
            alt="DimSum AI Labs Logo"
            width={24}
            height={24}
            className="rounded-sm"
          />
          <span className="ml-2 text-sm font-medium">DimSum AI</span>
        </div>
        <nav className="flex-1 overflow-auto py-4 px-3 space-y-1">
          <HamburgerMenuContent onNavClick={() => setMobileOpen(false)} />
        </nav>
      </div>
    </SheetContent>
  </Sheet>

  {/* User menu / Sign In */}
  {isAuthenticated ? (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Avatar className="h-6 w-6">
            <AvatarImage src={user?.avatar || ""} alt={user?.name || ""} />
            <AvatarFallback className="text-xs">
              {user?.name?.[0] || "U"}
            </AvatarFallback>
          </Avatar>
          <span className="hidden md:inline text-sm">
            {user?.name || "User"}
          </span>
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
            <DropdownMenuItem onClick={() => window.open("/admin", "_blank")}>
              <Settings className="mr-2 h-4 w-4" />
              {t("admin")}
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          {tCommon("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <Button variant="default" size="sm" onClick={() => setShowRoleSelect(true)}>
      {tCommon("signIn")}
    </Button>
  )}
</div>
```

**Step 3: Clean up now-unused variables**

Remove `navLinks` and `mobileNavLinks` constants from `search-header.tsx` since they're now defined inside `HamburgerMenuContent`.

**Step 4: Verify the desktop layout renders correctly**

Run dev server and open the search page on a wide viewport (`lg+`). Confirm:
- Right side shows only `[☰] [Avatar▼]` (or `[☰] [Sign In]`)
- Clicking ☰ opens a dropdown with Library / App Store / Docs / Language / Theme
- Clicking Avatar opens the user dropdown as before
- Search bar has noticeably more horizontal space

**Step 5: Verify mobile layout is unchanged**

Resize to mobile. Confirm:
- Hamburger opens the Sheet from the right
- Sheet contains nav links + language + theme (same as before)
- User avatar appears inline on the right (existing mobile layout)

**Step 6: Commit**

```bash
git add components/layout/search-header.tsx
git commit -m "feat: consolidate SearchHeader right side to hamburger + avatar only"
```

---

### Task 3: Remove duplicate mobile Sheet code

The mobile `<sm` layout (Two Row section) also has its own Sheet with nav links. Update it to use `HamburgerMenuContent` too.

**Files:**
- Modify: `components/layout/search-header.tsx`

**Step 1: Find the mobile Sheet in the Two Row layout**

Look for the comment `{/* Mobile Layout - Two Rows */}` → `{/* Left: Hamburger Menu */}` → the `Sheet` inside.

**Step 2: Replace the nav content inside that Sheet**

```tsx
// In the mobile Sheet inside Two Row layout, replace:
<nav className="flex-1 overflow-auto py-4 px-3 space-y-1">
  {/* Navigation Links */}
  {mobileNavLinks.map(...)}
  {/* Divider */}
  ...
  {/* Language & Theme Settings */}
  ...
</nav>

// With:
<nav className="flex-1 overflow-auto py-4 px-3 space-y-1">
  <HamburgerMenuContent onNavClick={() => setMobileOpen(false)} />
</nav>
```

**Step 3: Run dev and verify mobile two-row layout still works**

**Step 4: Commit**

```bash
git add components/layout/search-header.tsx
git commit -m "refactor: use HamburgerMenuContent in mobile two-row Sheet"
```
