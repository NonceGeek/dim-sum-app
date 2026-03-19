# HuggingFace Style Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor dimsum-app from sidebar navigation to HuggingFace-style top-bar navigation with modern blue-white color scheme, preserving all existing functionality.

**Architecture:** Remove `MainLayout`/`SidebarProvider`/`AppSidebar` wrapper. Replace with a new horizontal `Header` containing nav links + user dropdown. Update design tokens to modern bright blue scheme. Redesign homepage with dark gradient hero section.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS v4, shadcn/ui, lucide-react, next-themes, next-auth, Zustand

---

### Task 1: Update Color Primitives

**Files:**
- Modify: `main/styles/tokens/primitives.css`

**Step 1: Update the brand color palette from indigo (hue 250) to modern blue (hue 240)**

Replace the brand section in `primitives.css` with blue values tuned to match `#2563eb` (Blue-600) as the primary:

```css
  /* --------------------------------------------------------------------------
   * Brand (hue 230 — modern blue)
   * Tuned so brand-600 ≈ #2563eb, brand-500 ≈ #3b82f6
   * ------------------------------------------------------------------------ */
  --ds-color-brand-50:  oklch(0.97 0.01 230);
  --ds-color-brand-100: oklch(0.93 0.03 230);
  --ds-color-brand-200: oklch(0.87 0.08 230);
  --ds-color-brand-300: oklch(0.76 0.14 230);
  --ds-color-brand-400: oklch(0.66 0.19 230);
  --ds-color-brand-500: oklch(0.59 0.22 230);
  --ds-color-brand-600: oklch(0.52 0.22 230);
  --ds-color-brand-700: oklch(0.45 0.18 230);
  --ds-color-brand-800: oklch(0.37 0.14 230);
  --ds-color-brand-900: oklch(0.30 0.10 230);
  --ds-color-brand-950: oklch(0.23 0.07 230);
```

Also update the neutral hue from 250 to 230 to match:

```css
  /* Neutral (hue 230, very low chroma — tinted gray) */
  --ds-color-neutral-0:   oklch(1.00 0.000 230);
  --ds-color-neutral-50:  oklch(0.98 0.003 230);
  --ds-color-neutral-100: oklch(0.94 0.005 230);
  --ds-color-neutral-200: oklch(0.88 0.005 230);
  --ds-color-neutral-300: oklch(0.80 0.005 230);
  --ds-color-neutral-400: oklch(0.70 0.005 230);
  --ds-color-neutral-500: oklch(0.58 0.005 230);
  --ds-color-neutral-600: oklch(0.48 0.005 230);
  --ds-color-neutral-700: oklch(0.39 0.005 230);
  --ds-color-neutral-800: oklch(0.30 0.005 230);
  --ds-color-neutral-900: oklch(0.22 0.005 230);
  --ds-color-neutral-950: oklch(0.15 0.005 230);
```

And update shadow colors from hue 250 to 230 in the same file.

**Step 2: Verify the build compiles**

Run: `cd /Users/fun/Documents/GitHub/dimsum-app && pnpm build`
Expected: Build succeeds (colors are just CSS variable changes, no code impact)

**Step 3: Commit**

```bash
git add main/styles/tokens/primitives.css
git commit -m "style: update brand color palette from indigo to modern blue"
```

---

### Task 2: Update Semantic Tokens for Dark Theme

**Files:**
- Modify: `main/styles/tokens/semantic-dark.css`

**Step 1: Update dark mode to use deep blue-black background**

The dark theme should use a deep blue-black background instead of pure neutral-950. Add new primitive tokens for the dark background in `primitives.css` first:

```css
  /* Dark mode specific deep-blue backgrounds */
  --ds-color-dark-bg:      oklch(0.13 0.02 230);  /* ~#0c0f1a */
  --ds-color-dark-surface:  oklch(0.18 0.02 230);  /* ~#1a1f35 */
  --ds-color-dark-border:   oklch(0.25 0.02 230);  /* ~#2d3555 */
```

Then update `semantic-dark.css`:

```css
.dark {
  --background:         var(--ds-color-dark-bg);
  --foreground:         var(--ds-color-neutral-100);

  --card:               var(--ds-color-dark-surface);
  --card-foreground:    var(--ds-color-neutral-100);

  --popover:            var(--ds-color-dark-surface);
  --popover-foreground: var(--ds-color-neutral-100);

  /* ... keep brand, utility, functional colors as-is ... */

  --border: var(--ds-color-dark-border);
  --input:  var(--ds-color-dark-border);
}
```

**Step 2: Commit**

```bash
git add main/styles/tokens/primitives.css main/styles/tokens/semantic-dark.css
git commit -m "style: update dark theme to deep blue-black"
```

---

### Task 3: Remove Sidebar Layout Infrastructure

**Files:**
- Modify: `main/app/layout.tsx`
- Modify: `main/components/layout/conditional-layout.tsx`
- Modify: `main/components/layout/main-layout.tsx`

**Step 1: Simplify ConditionalLayout to remove sidebar wrapping**

Replace `main/components/layout/conditional-layout.tsx`:

```tsx
"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

interface ConditionalLayoutProps {
  children: ReactNode;
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();

  // Admin routes get no layout wrapping
  if (pathname.startsWith('/admin')) {
    return <>{children}</>;
  }

  // All other routes just pass through (Header/Footer handled by route layouts)
  return <>{children}</>;
}
```

Note: We keep ConditionalLayout as a thin wrapper for now to minimize blast radius. We can remove it entirely in a cleanup pass later.

**Step 2: Update main-layout.tsx to remove SidebarProvider**

Replace `main/components/layout/main-layout.tsx` — this file is kept but simplified (or can be deleted if no longer imported):

```tsx
import { ReactNode } from "react";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return <>{children}</>;
}
```

**Step 3: Verify the app still loads**

Run: `cd /Users/fun/Documents/GitHub/dimsum-app && pnpm dev`
Check: Navigate to `http://localhost:3000` — sidebar should be gone, pages should render.

**Step 4: Commit**

```bash
git add main/components/layout/conditional-layout.tsx main/components/layout/main-layout.tsx
git commit -m "refactor: remove sidebar layout infrastructure"
```

---

### Task 4: Rewrite Header with Horizontal Navigation

**Files:**
- Modify: `main/components/layout/header.tsx`

**Step 1: Rewrite the Header component**

The new Header should have:
- Left: Logo + "DimSum AI" brand text + horizontal nav links (Home, Library, App Store, Docs)
- Right: Theme toggle + User avatar with dropdown menu (containing Account submenus, Admin link, Sign Out)
- Mobile: Hamburger → Sheet drawer with all nav items
- Style: Sticky, white background, subtle bottom border, backdrop blur

```tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { Menu, Settings, LogOut, User, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle/theme-toggle";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { LoginDialog } from "@/components/dialogs/login-dialog";
import { RoleSelectDialog, UserRole } from "@/components/dialogs/role-select-dialog";
import { menuItems, getAccountSubmenuItems, workplaceSubmenuItems } from "./sidebar/menu-config";
import { Role } from "@prisma/client";
import { cn } from "@/lib/utils";

const navLinks = menuItems.filter(item => !item.children).map(item => ({
  label: item.label,
  href: item.href,
}));

// Add App Store separately (no children in top nav)
const allNavLinks = [
  { label: "Home", href: "/" },
  { label: "Library", href: "/library" },
  { label: "App Store", href: "/appStore" },
  { label: "Docs", href: "/docs" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { user, isAuthenticated, clearUser } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showRoleSelect, setShowRoleSelect] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

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

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 flex h-14 items-center justify-between">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="DimSum AI Labs Logo"
                width={28}
                height={28}
                className="w-7 h-7"
              />
              <span className="font-semibold text-foreground hidden sm:inline">
                DimSum AI
              </span>
            </Link>

            {/* Desktop nav links */}
            <nav className="hidden md:flex items-center gap-1">
              {allNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                    isActive(link.href)
                      ? "text-foreground bg-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right: Theme + User */}
          <div className="flex items-center gap-2">
            {session?.user?.isSystemAdmin && (
              <Button variant="ghost" size="sm" asChild className="hidden md:flex">
                <Link href="/admin" target="_blank" rel="noopener noreferrer">
                  <Settings className="w-4 h-4 mr-1" />
                  Admin
                </Link>
              </Button>
            )}

            <ThemeToggle />

            {/* User menu */}
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
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  {workplaceSubmenuItems.map((item) => (
                    <DropdownMenuItem key={item.href} onClick={() => router.push(item.href)}>
                      <item.icon className="mr-2 h-4 w-4" />
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowRoleSelect(true)}
              >
                Sign In
              </Button>
            )}

            {/* Mobile hamburger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
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
                    {allNavLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                          isActive(link.href)
                            ? "text-foreground bg-accent"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                        )}
                      >
                        {link.label}
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
                        Admin Panel
                      </Link>
                    )}
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Auth dialogs */}
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

**Step 2: Update Header usage in home layout**

In `main/app/(home)/layout.tsx`, remove props passed to Header (they're no longer needed):

```tsx
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/header";

export default function MainMenuLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="flex-1 overflow-y-auto">{children}</div>
      <Footer />
    </div>
  );
}
```

**Step 3: Update Header usage in account layout**

In `main/app/(account)/layout.tsx`, remove `titleClassName` prop:

```tsx
import { Header } from "@/components/layout/header";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--color-accent-background)]">
      <Header />
      <div className="min-h-[calc(100vh-56px)]">
        {children}
      </div>
    </div>
  );
}
```

**Step 4: Verify navigation works**

Run: `pnpm dev`
Check: All nav links work, user dropdown shows account items, mobile hamburger opens sheet.

**Step 5: Commit**

```bash
git add main/components/layout/header.tsx main/app/\(home\)/layout.tsx main/app/\(account\)/layout.tsx
git commit -m "feat: rewrite Header with horizontal nav + user dropdown"
```

---

### Task 5: Rewrite Footer (HuggingFace Style)

**Files:**
- Modify: `main/components/layout/Footer.tsx`

**Step 1: Rewrite Footer to multi-column HuggingFace style**

```tsx
import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/theme-toggle/theme-toggle";

const footerLinks = {
  Website: [
    { label: "Home", href: "/" },
    { label: "Library", href: "/library" },
    { label: "App Store", href: "/appStore" },
    { label: "Docs", href: "/docs" },
  ],
  Company: [
    { label: "About", href: "https://aidimsum.com/", external: true },
    { label: "Terms", href: "/terms" },
    { label: "Privacy", href: "/privacy" },
  ],
  Resources: [
    { label: "Documentation", href: "/docs" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Image
                src="/logo.png"
                alt="DimSum AI Labs Logo"
                width={24}
                height={24}
              />
              <span className="font-semibold text-sm">DimSum AI Labs</span>
            </div>
            <ThemeToggle />
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {category}
              </h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} DIMSUM AI Labs. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            苏ICP备2025170597号
          </p>
        </div>
      </div>
    </footer>
  );
}
```

**Step 2: Commit**

```bash
git add main/components/layout/Footer.tsx
git commit -m "feat: rewrite Footer to HuggingFace-style multi-column layout"
```

---

### Task 6: Redesign Homepage with Dark Hero Section

**Files:**
- Modify: `main/app/(home)/page.tsx`

**Step 1: Add a dark gradient hero section**

Wrap the existing search bar in a hero section. The hero has a dark blue gradient background when no results are shown. When results appear, it shrinks to just the search bar area.

Key changes to the existing `page.tsx`:
- Add a hero wrapper `<section>` with gradient background `bg-gradient-to-br from-[#0c0f1a] via-[#1a1f35] to-[#0c0f1a]`
- Title "Try Some Cantonese" in white text inside hero
- Add subtitle below title
- Add CTA links "Browse Library" | "Explore App Store" below search
- Example cards use pill-style rounded buttons instead of cards
- When results are shown, hero collapses and search stays at top

The full component is large. Key structural change to the return JSX:

```tsx
return (
  <>
    {/* Hero Section */}
    <section className={cn(
      "transition-all duration-700 ease-out",
      results && results.length > 0
        ? "py-6 bg-gradient-to-r from-primary/5 to-primary/10"
        : "py-16 md:py-24 bg-gradient-to-br from-[#0c0f1a] via-[#1a1f35] to-[#0c0f1a]"
    )}>
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          {/* Title - hidden when results shown */}
          {!(results && results.length > 0) && (
            <motion.div ...>
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                Try Some Cantonese
              </h1>
              <p className="text-lg text-white/70 mt-3">
                The AI-powered platform for Cantonese learning and research
              </p>
            </motion.div>
          )}

          {/* Search bar - always visible */}
          <div className="flex gap-2 max-w-2xl mx-auto">
            {/* existing search input + dataset selector + button */}
            {/* Update input/button styles for dark hero background */}
          </div>

          {/* CTA links - hidden when results shown */}
          {!(results && results.length > 0) && (
            <div className="flex items-center justify-center gap-4 text-sm">
              <span className="text-white/50">or</span>
              <Link href="/library" className="text-white hover:text-white/80 underline">
                Browse Library
              </Link>
              <span className="text-white/30">|</span>
              <Link href="/appStore" className="text-white hover:text-white/80 underline">
                Explore App Store
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>

    {/* Example cards - below hero */}
    {results === null && (
      <section className="container mx-auto px-4 py-8">
        <div className="flex flex-wrap justify-center gap-3">
          {examples.map(ex => (
            <button
              key={ex.prompt}
              onClick={() => handleExampleSearch(ex.prompt)}
              className="px-4 py-2 rounded-full border text-sm hover:bg-accent transition-colors"
            >
              {ex.title}: {ex.prompt}
            </button>
          ))}
        </div>
        <p className="text-center mt-6 ...">
          <a href="https://www.aidimsum.com/zh#stats">查看数据情况</a>
        </p>
      </section>
    )}

    {/* Results section - existing logic preserved */}
    {/* ... keep all existing result rendering, pagination, etc ... */}

    <EditCorpusDialog ... />
  </>
);
```

The key principle: preserve ALL existing search/results/pagination logic, just restructure the visual wrapper.

**Step 2: Verify homepage renders correctly**

Run: `pnpm dev`
Check:
- Homepage shows dark hero with title, search bar, CTAs
- Example cards appear below hero as pills
- Searching shows results below a collapsed hero
- Pagination works
- "Back to Home" works

**Step 3: Commit**

```bash
git add main/app/\(home\)/page.tsx
git commit -m "feat: redesign homepage with dark gradient hero section"
```

---

### Task 7: Clean Up Sidebar Tokens from CSS

**Files:**
- Modify: `main/styles/tokens/semantic-light.css`
- Modify: `main/styles/tokens/semantic-dark.css`
- Modify: `main/app/globals.css`

**Step 1: Remove sidebar-specific tokens from semantic-light.css**

Remove the entire `SIDEBAR` section (lines 92-102) from `semantic-light.css`. These tokens are no longer needed.

**Step 2: Remove sidebar-specific tokens from semantic-dark.css**

Remove the entire `SIDEBAR` section (lines 98-108) from `semantic-dark.css`.

**Step 3: Remove sidebar theme mappings from globals.css**

Remove lines 12-21 from `globals.css` (the `--color-sidebar-*` theme mappings):

```css
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent-background: var(--sidebar-accent-background);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-background: var(--sidebar-primary-background);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
```

Note: Only remove these if no other component (like Sheet) references them. Check first with grep. If shadcn's `Sheet` or `Sidebar` UI component imports reference them, keep them.

**Step 4: Verify build**

Run: `pnpm build`
Expected: Build succeeds with no missing variable errors.

**Step 5: Commit**

```bash
git add main/styles/tokens/semantic-light.css main/styles/tokens/semantic-dark.css main/app/globals.css
git commit -m "style: remove unused sidebar tokens from design system"
```

---

### Task 8: Visual Polish Pass

**Files:**
- Various component files

**Step 1: Check all pages render correctly with new layout**

Navigate to each route and verify:
- `/` — Homepage with hero
- `/library` — Library page
- `/appStore` — App Store page
- `/docs` — Docs page
- `/account/profile` — Account profile (via user dropdown)
- `/account/my-record` — My record
- `/workplace/api` — API page
- Theme toggle works (light/dark/system)
- Mobile responsive: hamburger menu opens, nav links work

**Step 2: Fix any visual issues found**

Common issues to look for:
- Pages that used `bg-[var(--color-accent-background)]` might look wrong
- Any component that imports from `@/components/ui/sidebar` (check with grep)
- The account layout still references `accent-background` — verify it works

**Step 3: Final commit**

```bash
git add -A
git commit -m "style: visual polish and cleanup after HuggingFace refactor"
```

---

### Task 9: Verify and Final Build

**Step 1: Run full build**

Run: `cd /Users/fun/Documents/GitHub/dimsum-app && pnpm build`
Expected: Build succeeds with no errors.

**Step 2: Run dev server and test all flows**

Run: `pnpm dev`
Test:
- [ ] Homepage hero + search + results
- [ ] Navigation via top bar (all 4 links)
- [ ] User dropdown (login, account links, logout)
- [ ] Mobile hamburger menu
- [ ] Dark/light theme switching
- [ ] App Store page with category filters
- [ ] Admin link (if admin user)

**Step 3: Final commit if needed**

```bash
git add -A
git commit -m "chore: final cleanup after HuggingFace style refactor"
```
