# DimSum Homepage Google-Style Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform DimSum homepage from a search+results dashboard into a Google-style search portal with centered logo, search bar, hot search pills, and floating navigation.

**Architecture:** Split the current single-page search experience into two pages: a minimal search portal (homepage) and a full search results page (`/search`). Extract header navigation into a floating nav component for the homepage. Reuse existing `useSearch` hook and result card components on the search results page.

**Tech Stack:** Next.js 14 App Router, React 19, TypeScript, Tailwind CSS, motion/react (Framer Motion), shadcn/ui, next-auth, next-themes

**Base Path:** All file paths are relative to `/Users/fun/Documents/GitHub/dimsum-app/main/`

---

## Task 1: Create the Search Results Page

Move the current homepage's search result logic to a dedicated `/search` route. This page will have the full Header, search results, pagination, category filtering, and Footer.

**Files:**
- Create: `app/(home)/search/page.tsx`

**Step 1: Create the search results page**

Create `app/(home)/search/page.tsx` with the current homepage's search logic. This is essentially the current `page.tsx` but:
- Always shows the collapsed hero (search bar at top with light gradient)
- Reads `?q=` and `?dataset=` from URL params to trigger search
- Shows results, pagination, category selector, "try other searches"
- Navigates back to `/` when "Back to Home" is clicked

```tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearch, type SearchResult } from "@/lib/api/search";
import { toast } from "sonner";
import { Search, SearchX } from "lucide-react";
import { motion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { EditCorpusDialog } from "@/components/dialogs/edit-corpus-dialog";
import { DictionaryNote } from "@/lib/types";
import WordLyricCardDetail from "../_components/word-lyric-card-detail";
import YueSongCardDetail from "../_components/yue-song-card-detail";
import { useAllCategories } from "@/lib/api/category";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import CategorySelector from "../_components/category-selector";
import { cn } from "@/lib/utils";

function isDictionaryNote(note: SearchResult["note"]): note is DictionaryNote {
  return !Array.isArray(note) && "context" in note;
}

export default function SearchPage() {
  const [searchPrompt, setSearchPrompt] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const { mutate: search, isPending } = useSearch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [editingResult, setEditingResult] = useState<SearchResult | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<string[]>(["all"]);
  const [inputValue, setInputValue] = useState<string>("");
  const [selectCategory, setSelectCategory] = useState<string>("全部");

  const { data: categories } = useAllCategories();
  const fiter_not_in = [
    { id: "all", name: "all", nickname: "全局搜索" },
    ...(categories || [])?.filter((cat) => cat.if_in_all_data),
  ];

  // Read search params from URL and trigger search
  useEffect(() => {
    const keyword = searchParams.get("q") || "";
    const datasetParam = searchParams.get("dataset") || "";

    if (!keyword) {
      router.push("/");
      return;
    }

    const datasetName = fiter_not_in
      .map((cat) =>
        datasetParam.split(",").includes(cat.nickname ?? cat.name)
          ? cat.name
          : null
      )
      .filter(Boolean) as string[];

    setSearchPrompt(keyword);
    setSelectedDataset(datasetName.length ? datasetName : ["all"]);
    setCurrentPage(1);

    search(
      {
        keyword,
        category: JSON.stringify(datasetName.length ? datasetName : ["all"]),
      },
      {
        onSuccess: setResults,
        onError: (error: Error) => {
          toast.error("Search failed", { description: error.message });
        },
      }
    );
  }, [searchParams, JSON.stringify(fiter_not_in)]);

  const handleSearch = () => {
    if (!searchPrompt.trim()) return;
    setCurrentPage(1);
    setSelectCategory("全部");

    const dataset = fiter_not_in
      .map((cat) => {
        if (selectedDataset.includes(cat.name)) {
          return cat.nickname ?? cat.name;
        }
        return null;
      })
      .filter(Boolean);

    const params = new URLSearchParams();
    params.set("q", searchPrompt.trim());
    params.set("dataset", dataset.join(","));
    router.push(`/search?${params.toString()}`, { scroll: false });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleExampleSearch = (prompt: string) => {
    const params = new URLSearchParams();
    params.set("q", prompt);
    params.set("dataset", "全局搜索");
    router.push(`/search?${params.toString()}`, { scroll: false });
  };

  const filteredResults = useMemo(() => {
    if (!results) return [];
    return results.filter(
      (result) => selectCategory === "全部" || result.category === selectCategory
    );
  }, [results, selectCategory]);

  const totalPages = Math.ceil((filteredResults?.length || 0) / itemsPerPage);
  const currentResults =
    filteredResults?.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    ) || [];

  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const showPages = 5;
    if (totalPages <= showPages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    pages.push(1);
    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(totalPages - 1, currentPage + 1);
    if (currentPage <= 3) endPage = 4;
    else if (currentPage >= totalPages - 2) startPage = totalPages - 3;
    if (startPage > 2) pages.push("...");
    for (let i = startPage; i <= endPage; i++) pages.push(i);
    if (endPage < totalPages - 1) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  return (
    <>
      {/* Compact search header */}
      <section className="py-6 bg-gradient-to-r from-primary/5 to-primary/10">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-muted-foreground" />
                </div>
                <Input
                  placeholder="Search Cantonese content..."
                  value={searchPrompt}
                  onChange={(e) => setSearchPrompt(e.target.value)}
                  onKeyDown={handleKeyPress}
                  className="pl-10 h-12 text-lg dark:text-accent-foreground dark:placeholder:text-accent-foreground dark:bg-background"
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[180px] justify-between truncate h-12 hover:bg-background! dark:bg-background dark:text-accent-foreground"
                  >
                    {(fiter_not_in || [])
                      ?.map((cat) => {
                        if (selectedDataset.includes(cat.name)) {
                          return cat.nickname || cat.name;
                        }
                        return null;
                      })
                      .filter(Boolean)
                      .join(", ") || "请选择"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                  <Command className="bg-background!">
                    <CommandInput
                      placeholder="搜索数据集"
                      value={inputValue}
                      onValueChange={setInputValue}
                    />
                    <CommandList>
                      {(fiter_not_in || [])?.map((cat) => (
                        <CommandItem
                          key={cat.id}
                          value={cat.nickname || cat.name}
                          onSelect={() => {
                            if (cat.name === "all") {
                              setSelectedDataset(["all"]);
                              return;
                            }
                            setSelectedDataset((prev) =>
                              (prev.includes(cat.name)
                                ? prev.filter((item) => item !== cat.name)
                                : [...prev, cat.name]
                              ).filter((item) => item !== "all")
                            );
                          }}
                        >
                          <Checkbox
                            className="mr-2 dark:bg-accent-background"
                            checked={selectedDataset.includes(cat.name)}
                            id={cat.id + ""}
                          />
                          {cat.nickname ?? cat.name}
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button
                onClick={handleSearch}
                disabled={isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-12 px-6"
              >
                {isPending ? "Searching..." : "Search"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Loading skeletons */}
      {isPending && (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-6 shadow-md mb-4">
              <div className="space-y-6">
                <Skeleton className="h-7 w-2/5" />
                <div className="space-y-3 rounded-lg p-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                </div>
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Results */}
      {results && results.length > 0 && (
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <CategorySelector
            selectCategory={selectCategory}
            setSelectCategory={setSelectCategory}
            results={results}
            selectedDataset={selectedDataset}
          />
          {currentResults.map((result, index) => (
            <motion.div
              key={result.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: index * 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {result.category !== "粤语曲库" && (
                <WordLyricCardDetail
                  result={result}
                  setEditingResult={setEditingResult}
                  setUpdateDialogOpen={setUpdateDialogOpen}
                  isDictionaryNote={isDictionaryNote}
                />
              )}
              {result.category === "粤语曲库" && (
                <YueSongCardDetail result={result} />
              )}
            </motion.div>
          ))}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-10 h-10"
              >
                &lt;
              </Button>
              {getPageNumbers().map((page, idx) =>
                page === "..." ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="w-10 h-10 flex items-center justify-center text-muted-foreground"
                  >
                    ...
                  </span>
                ) : (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    onClick={() => setCurrentPage(page as number)}
                    className="w-10 h-10"
                  >
                    {page}
                  </Button>
                )
              )}
              <Button
                variant="outline"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="w-10 h-10"
              >
                &gt;
              </Button>
            </div>
          )}

          {/* Try other searches */}
          <div className="mt-12">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-muted-foreground">
                Try other searches
              </h3>
              <Button
                variant="outline"
                onClick={() => router.push("/")}
                className="text-sm"
              >
                Back to Home
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {[
                { title: "Cantonese Lyrics", prompt: "落花流水" },
                { title: "Chinese Words", prompt: "姐姐" },
                { title: "Single Character", prompt: "行" },
                { title: "Video Example", prompt: "歡聚一堂" },
              ].map(
                (example) =>
                  example.prompt !== searchPrompt && (
                    <Card
                      key={example.prompt}
                      className="p-3 sm:p-4 hover:shadow-lg cursor-pointer hover:bg-accent transition-colors duration-200 h-24 sm:h-28 flex items-center justify-center"
                      onClick={() => {
                        if (isPending) return;
                        setResults(null);
                        handleExampleSearch(example.prompt);
                      }}
                    >
                      <div className="text-center space-y-1 sm:space-y-2">
                        <h3 className="text-xs sm:text-sm font-medium text-foreground">
                          {example.title}
                        </h3>
                        <p className="text-sm sm:text-base text-muted-foreground">
                          {example.prompt}
                        </p>
                      </div>
                    </Card>
                  )
              )}
            </div>
          </div>
        </div>
      )}

      {/* No results */}
      {results && results.length === 0 && (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="p-4 rounded-full bg-muted">
              <SearchX className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-foreground">
                No results found
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                We couldn&apos;t find any matches for &quot;{searchPrompt}
                &quot;. Try different keywords or check examples below.
              </p>
              <Button
                variant="outline"
                onClick={() => router.push("/")}
                className="mt-4"
              >
                返回首页
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6">
              {[
                { title: "Cantonese Lyrics", prompt: "淡淡交會過" },
                { title: "Chinese Words", prompt: "姐姐" },
                { title: "Single Character", prompt: "行" },
                { title: "Video Example", prompt: "歡聚一堂" },
              ].map((example) => (
                <Card
                  key={example.prompt}
                  className="p-3 sm:p-4 hover:shadow-lg transition-shadow cursor-pointer hover:bg-accent h-24 sm:h-28 flex items-center justify-center"
                  onClick={() => handleExampleSearch(example.prompt)}
                >
                  <div className="text-center space-y-1 sm:space-y-2">
                    <h3 className="text-xs sm:text-sm font-medium text-foreground">
                      {example.title}
                    </h3>
                    <p className="text-sm sm:text-base text-muted-foreground">
                      {example.prompt}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      <EditCorpusDialog
        open={updateDialogOpen}
        onOpenChange={setUpdateDialogOpen}
        editingResult={editingResult}
      />
    </>
  );
}
```

**Step 2: Verify the page renders**

Run: `cd /Users/fun/Documents/GitHub/dimsum-app && pnpm dev`

Open `http://localhost:3000/search?q=行` in browser. Should show the compact search header + results.

**Step 3: Commit**

```bash
git add app/(home)/search/page.tsx
git commit -m "feat: create dedicated search results page at /search"
```

---

## Task 2: Create FloatingNav Component

Create the floating top-right navigation that replaces the Header on the homepage.

**Files:**
- Create: `components/layout/floating-nav.tsx`

**Step 1: Create the FloatingNav component**

```tsx
"use client";

import Link from "next/link";
import { Menu, Settings, LogOut, ChevronDown } from "lucide-react";
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
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { LoginDialog } from "@/components/dialogs/login-dialog";
import { RoleSelectDialog, UserRole } from "@/components/dialogs/role-select-dialog";
import { getAccountSubmenuItems, workplaceSubmenuItems } from "./sidebar/menu-config";
import { Role } from "@prisma/client";
import Image from "next/image";

const navLinks = [
  { label: "Library", href: "/library" },
  { label: "App Store", href: "/appStore" },
  { label: "Docs", href: "/docs" },
];

export function FloatingNav() {
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

  return (
    <>
      <nav className="fixed top-4 right-6 z-50 flex items-center gap-4">
        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {session?.user?.isSystemAdmin && (
          <Button variant="ghost" size="sm" asChild className="hidden md:flex h-8">
            <Link href="/admin" target="_blank" rel="noopener noreferrer">
              <Settings className="w-4 h-4" />
            </Link>
          </Button>
        )}

        <ThemeToggle />

        {/* User menu */}
        {isAuthenticated ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 h-8">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={user?.avatar || ""} alt={user?.name || ""} />
                  <AvatarFallback className="text-xs">
                    {user?.name?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
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
            className="h-8"
            onClick={() => setShowRoleSelect(true)}
          >
            Sign In
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
                <Link
                  href="/"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50"
                >
                  Home
                </Link>
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </SheetContent>
        </Sheet>
      </nav>

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

**Step 2: Verify it compiles**

Run: `pnpm build` (or check dev server for compilation errors)

**Step 3: Commit**

```bash
git add components/layout/floating-nav.tsx
git commit -m "feat: create FloatingNav component for Google-style homepage"
```

---

## Task 3: Create MinimalFooter Component

A single-line footer for the homepage.

**Files:**
- Create: `app/(home)/_components/minimal-footer.tsx`

**Step 1: Create the MinimalFooter**

```tsx
export function MinimalFooter() {
  return (
    <footer className="mt-auto px-6 py-4 flex justify-between items-center">
      <p className="text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} DimSum AI Labs
      </p>
      <p className="text-xs text-muted-foreground">
        苏ICP备2025170597号
      </p>
    </footer>
  );
}
```

**Step 2: Commit**

```bash
git add app/(home)/_components/minimal-footer.tsx
git commit -m "feat: create MinimalFooter component"
```

---

## Task 4: Rewrite the Homepage

Replace the current `app/(home)/page.tsx` with the Google-style search portal.

**Files:**
- Modify: `app/(home)/page.tsx` (complete rewrite)

**Step 1: Rewrite the homepage**

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSearch, type SearchResult } from "@/lib/api/search";
import { Search } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FloatingNav } from "@/components/layout/floating-nav";
import { MinimalFooter } from "./_components/minimal-footer";
import { cn } from "@/lib/utils";

const hotSearches = [
  "落花流水",
  "唔听",
  "行",
  "姐姐",
  "歡聚一堂",
  "帆船",
];

export default function HomePage() {
  const [searchPrompt, setSearchPrompt] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const { mutate: search, isPending } = useSearch();
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search for suggestions
  const handleInputChange = (value: string) => {
    setSearchPrompt(value);
    setSelectedIndex(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length === 0) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      search(
        { keyword: value.trim(), category: JSON.stringify(["all"]) },
        {
          onSuccess: (results) => {
            setSuggestions(results.slice(0, 6));
            setShowSuggestions(true);
          },
        }
      );
    }, 300);
  };

  const navigateToSearch = (query: string) => {
    const params = new URLSearchParams();
    params.set("q", query);
    params.set("dataset", "全局搜索");
    router.push(`/search?${params.toString()}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        navigateToSearch(suggestions[selectedIndex].data);
      } else if (searchPrompt.trim()) {
        navigateToSearch(searchPrompt.trim());
      }
      setShowSuggestions(false);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    }
  };

  const handleSuggestionClick = (suggestion: SearchResult) => {
    navigateToSearch(suggestion.data);
    setShowSuggestions(false);
  };

  const handleSearchClick = () => {
    if (searchPrompt.trim()) {
      navigateToSearch(searchPrompt.trim());
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background relative">
      {/* Subtle brand atmosphere gradient */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 40%, oklch(0.95 0.02 256 / 0.08), transparent 70%)",
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none dark:block hidden"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 40%, oklch(0.20 0.03 256 / 0.15), transparent 70%)",
        }}
      />

      {/* Floating navigation */}
      <FloatingNav />

      {/* Main content — centered */}
      <main className="flex-1 flex flex-col items-center pt-[25vh] px-4 relative z-10">
        {/* Logo + Brand */}
        <motion.div
          className="flex flex-col items-center gap-3 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Image
            src="/logo.png"
            alt="DimSum AI Labs Logo"
            width={72}
            height={72}
            className="w-18 h-18"
          />
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
            DimSum AI Labs
          </h1>
          <p className="text-sm text-muted-foreground">
            Discover and explore AI resources
          </p>
        </motion.div>

        {/* Search bar */}
        <motion.div
          ref={searchRef}
          className="w-full max-w-[580px] relative"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div
            className={cn(
              "flex items-center border rounded-full shadow-sm hover:shadow-md transition-shadow bg-background",
              showSuggestions && suggestions.length > 0
                ? "rounded-b-none shadow-md border-b-0"
                : ""
            )}
          >
            <div className="pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <Input
              placeholder="搜索 AI 模型、工具、资源..."
              value={searchPrompt}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              className="flex-1 h-12 text-base border-0 shadow-none focus-visible:ring-0 bg-transparent"
            />
            <Button
              onClick={handleSearchClick}
              disabled={isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-9 px-5 mr-1.5"
            >
              搜索
            </Button>
          </div>

          {/* Suggestions dropdown */}
          <AnimatePresence>
            {showSuggestions && suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 right-0 bg-background border border-t-0 rounded-b-2xl shadow-lg overflow-hidden z-50"
              >
                <div className="border-t mx-4" />
                {suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion.id}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={cn(
                      "w-full px-4 py-2.5 flex items-center gap-3 text-left text-sm transition-colors",
                      index === selectedIndex
                        ? "bg-accent"
                        : "hover:bg-accent/50"
                    )}
                  >
                    <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate text-foreground">
                      {suggestion.data}
                    </span>
                    {suggestion.category && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                        {suggestion.category}
                      </span>
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Hot search pills */}
        <motion.div
          className="flex flex-wrap justify-center gap-2 mt-6 max-w-[580px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <span className="text-xs text-muted-foreground flex items-center mr-1">
            热搜
          </span>
          {hotSearches.map((term) => (
            <button
              key={term}
              onClick={() => navigateToSearch(term)}
              className="px-3 py-1.5 rounded-full border text-sm text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-colors cursor-pointer"
            >
              {term}
            </button>
          ))}
        </motion.div>
      </main>

      {/* Minimal footer */}
      <MinimalFooter />
    </div>
  );
}
```

**Step 2: Verify the homepage renders**

Open `http://localhost:3000` in browser. Should show:
- Floating nav in top-right
- Centered logo + brand name + subtitle
- Large pill search bar
- Hot search pills below
- Minimal footer at bottom
- Subtle blue radial gradient in background

**Step 3: Commit**

```bash
git add app/(home)/page.tsx
git commit -m "feat: rewrite homepage as Google-style search portal"
```

---

## Task 5: Update Layout to Conditionally Hide Header

The homepage should NOT show the Header, but the search results page and other pages under `(home)` should.

**Files:**
- Modify: `app/(home)/layout.tsx`

**Step 1: Make the layout conditional**

The homepage renders its own FloatingNav and MinimalFooter, so it doesn't need the layout's Header/Footer. The simplest approach: the homepage is self-contained (already includes FloatingNav + MinimalFooter), and the layout provides Header/Footer for child routes like `/search`.

We need to detect if we're on the homepage and skip Header/Footer if so.

```tsx
"use client";

import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/header";
import { usePathname } from "next/navigation";

export default function MainMenuLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isHomepage = pathname === "/";

  if (isHomepage) {
    // Homepage renders its own layout (FloatingNav + MinimalFooter)
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="flex-1 overflow-y-auto">{children}</div>
      <Footer />
    </div>
  );
}
```

**Step 2: Verify both pages**

1. `http://localhost:3000` — Should show Google-style homepage (no Header, no Footer from layout)
2. `http://localhost:3000/search?q=行` — Should show full Header + search results + Footer

**Step 3: Commit**

```bash
git add app/(home)/layout.tsx
git commit -m "feat: conditionally hide Header/Footer on homepage"
```

---

## Task 6: Fix URL Routing for Search

Update all search-related navigation to point to `/search` instead of `/`.

**Files:**
- Verify: `app/(home)/page.tsx` — already navigates to `/search`
- Verify: `app/(home)/search/page.tsx` — already uses `/search` URLs
- Check: Any other files that might link to `/?q=` pattern

**Step 1: Search for old URL patterns**

Search the codebase for any `/?q=` or `router.push("/?` patterns that should now use `/search`.

**Step 2: Fix any found references**

Update any remaining references from `/?q=xxx` to `/search?q=xxx`.

**Step 3: Commit if changes were made**

```bash
git commit -am "fix: update search URLs to use /search route"
```

---

## Task 7: Verify & Polish

End-to-end verification of the full flow.

**Step 1: Test the complete user flow**

1. Open homepage → see Google-style layout
2. Type in search bar → see real-time suggestions dropdown
3. Click a suggestion → navigate to `/search?q=xxx` with results
4. Press Enter → navigate to `/search?q=xxx` with results
5. Click a hot search pill → navigate to `/search?q=xxx`
6. On search results page, click "Back to Home" → return to `/`
7. Toggle dark mode → verify background gradient, search bar, pills all adapt
8. Test mobile responsive → hamburger menu, full-width search bar

**Step 2: Fix any visual issues**

Common things to check:
- Search bar focus ring visibility
- Suggestions dropdown z-index over other elements
- Dark mode gradient visibility
- Mobile FloatingNav hamburger positioning
- Footer pinned to bottom on short content

**Step 3: Final commit**

```bash
git commit -am "polish: final visual adjustments for Google-style homepage"
```

---

## Summary of All File Changes

| Action | File | Description |
|--------|------|-------------|
| Create | `app/(home)/search/page.tsx` | Search results page (migrated from homepage) |
| Create | `components/layout/floating-nav.tsx` | Floating top-right navigation |
| Create | `app/(home)/_components/minimal-footer.tsx` | Single-line footer |
| Rewrite | `app/(home)/page.tsx` | Google-style search portal |
| Modify | `app/(home)/layout.tsx` | Conditionally hide Header/Footer on homepage |
