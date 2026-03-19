# Homepage Redesign: HF Spaces Style — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a trending datasets grid below the hero on the homepage, shown when no search is active, following HF Spaces visual style.

**Architecture:** Two new components (`DatasetCard`, `DatasetGrid`) placed in `app/(home)/_components/`. The homepage conditionally renders the grid when `results === null && !isPending`. Data comes from the existing `useAllCategories()` hook (already called in `page.tsx`).

**Tech Stack:** Next.js 14, React 19, TypeScript, Tailwind CSS 4, shadcn/ui Card, next/image, motion (framer-motion), lucide-react

---

### Task 1: Update CategoryInfo interface

**Files:**
- Modify: `main/lib/api/category.ts`

**Step 1: Add missing fields to CategoryInfo**

The library page's `Corpus` type has `size` and `sorting` fields that `CategoryInfo` lacks. The API returns these fields — add them to the interface.

```typescript
// In CategoryInfo interface, add after the existing fields:
  size?: number | null;
  sorting?: number | null;
```

Add these two lines after `if_in_all_data?: boolean;` (line 19) in the `CategoryInfo` interface.

**Step 2: Verify the build still works**

Run: `cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm build`
Expected: Build succeeds (no type errors)

**Step 3: Commit**

```bash
git add main/lib/api/category.ts
git commit -m "feat: add size and sorting fields to CategoryInfo interface"
```

---

### Task 2: Create DatasetCard component

**Files:**
- Create: `main/app/(home)/_components/dataset-card.tsx`

**Step 1: Create the DatasetCard component**

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { Pin } from "lucide-react";
import type { CategoryInfo } from "@/lib/api/category";

function getTagDisplay(tag: string): string {
  switch (tag.toLowerCase()) {
    case "classic":
      return "经典";
    case "dict":
      return "字典";
    default:
      return tag;
  }
}

export function DatasetCard({ dataset }: { dataset: CategoryInfo }) {
  const displayName = dataset.nickname || dataset.name;
  const tags = Array.isArray(dataset.tags) ? dataset.tags.slice(0, 3) : [];

  return (
    <Link href={`/library`}>
      <div className="group bg-card rounded-xl border shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
        {/* Cover image */}
        <div className="aspect-video bg-muted relative overflow-hidden">
          {dataset.cover ? (
            <Image
              src={dataset.cover}
              alt={displayName}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              unoptimized
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <span className="text-4xl font-bold text-primary/40">
                {displayName.charAt(0)}
              </span>
            </div>
          )}
          {dataset.pinned && (
            <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 text-white rounded-md text-xs flex items-center gap-1">
              <Pin className="w-3 h-3" />
              置顶
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-2">
          <h3 className="font-semibold text-base leading-tight truncate">
            {displayName}
          </h3>

          {dataset.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {dataset.description}
            </p>
          )}

          <div className="flex items-center justify-between pt-1">
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag: string, index: number) => (
                  <span
                    key={index}
                    className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded-full text-xs border border-border"
                  >
                    {getTagDisplay(tag)}
                  </span>
                ))}
              </div>
            )}
            {dataset.size != null && (
              <span className="text-xs text-muted-foreground whitespace-nowrap ml-auto">
                {dataset.size.toFixed(2)} GB
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
```

**Step 2: Verify no type errors**

Run: `cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add main/app/\(home\)/_components/dataset-card.tsx
git commit -m "feat: add DatasetCard component for homepage grid"
```

---

### Task 3: Create DatasetGrid component

**Files:**
- Create: `main/app/(home)/_components/dataset-grid.tsx`

**Step 1: Create the DatasetGrid component**

```tsx
"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { CategoryInfo } from "@/lib/api/category";
import { DatasetCard } from "./dataset-card";

interface DatasetGridProps {
  categories: CategoryInfo[] | undefined;
  isLoading: boolean;
}

export function DatasetGrid({ categories, isLoading }: DatasetGridProps) {
  const sortedCategories = useMemo(() => {
    if (!categories) return [];
    return [...categories]
      .filter((cat) => cat.if_in_all_data !== false)
      .sort((a, b) => {
        // Pinned first
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        // Then by sorting ascending
        const aSort = a.sorting ?? 0;
        const bSort = b.sorting ?? 0;
        return aSort - bSort;
      });
  }, [categories]);

  if (isLoading) {
    return (
      <section className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border overflow-hidden">
              <Skeleton className="aspect-video w-full rounded-none" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <div className="flex gap-1.5 pt-1">
                  <Skeleton className="h-5 w-12 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (sortedCategories.length === 0) return null;

  return (
    <section className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">热门数据集</h2>
        <Link
          href="/library"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          查看全部
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {sortedCategories.map((category, index) => (
          <motion.div
            key={category.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: index * 0.05,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <DatasetCard dataset={category} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
```

**Step 2: Verify no type errors**

Run: `cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add main/app/\(home\)/_components/dataset-grid.tsx
git commit -m "feat: add DatasetGrid component with loading skeleton"
```

---

### Task 4: Integrate DatasetGrid into homepage

**Files:**
- Modify: `main/app/(home)/page.tsx`

**Step 1: Add DatasetGrid import**

Add this import after line 32 (the `CategorySelector` import):

```typescript
import { DatasetGrid } from "./_components/dataset-grid";
```

**Step 2: Add DatasetGrid section to the JSX**

In the `return` block of `HomePage`, find the `{/* Example pills */}` section (around line 373). This section renders when `results === null && !isPending`. Add the `DatasetGrid` component right after the closing `</section>` of the example pills block (after line 398), still inside the same `results === null && !isPending` conditional.

Replace this block (lines 372–399):

```tsx
      {/* Example pills - only when no results and not loading */}
      {results === null && !isPending && (
        <section className="container mx-auto px-4 py-8">
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { title: "Cantonese Lyrics", prompt: "落花流水" },
              { title: "News", prompt: "唔听" },
              { title: "Single Character", prompt: "行" },
              { title: "Chinese Words", prompt: "姐姐" },
              { title: "Video Example", prompt: "歡聚一堂" },
              { title: "3D Model", prompt: "帆船" },
            ].map((example) => (
              <button
                key={example.prompt}
                onClick={() => handleExampleSearch(example.prompt)}
                className="px-4 py-2 rounded-full border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                {example.title}: {example.prompt}
              </button>
            ))}
          </div>
          <p className="text-sm text-center text-muted-foreground mt-6 underline">
            <a href="https://www.aidimsum.com/zh#stats" target="_blank" rel="noopener noreferrer">
              👉 查看数据情况 👈
            </a>
          </p>
        </section>
      )}
```

With this (keeping example pills + adding DatasetGrid below):

```tsx
      {/* Example pills + Dataset grid - only when no results and not loading */}
      {results === null && !isPending && (
        <>
          <section className="container mx-auto px-4 py-8">
            <div className="flex flex-wrap justify-center gap-3">
              {[
                { title: "Cantonese Lyrics", prompt: "落花流水" },
                { title: "News", prompt: "唔听" },
                { title: "Single Character", prompt: "行" },
                { title: "Chinese Words", prompt: "姐姐" },
                { title: "Video Example", prompt: "歡聚一堂" },
                { title: "3D Model", prompt: "帆船" },
              ].map((example) => (
                <button
                  key={example.prompt}
                  onClick={() => handleExampleSearch(example.prompt)}
                  className="px-4 py-2 rounded-full border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  {example.title}: {example.prompt}
                </button>
              ))}
            </div>
            <p className="text-sm text-center text-muted-foreground mt-6 underline">
              <a href="https://www.aidimsum.com/zh#stats" target="_blank" rel="noopener noreferrer">
                👉 查看数据情况 👈
              </a>
            </p>
          </section>

          {/* Trending datasets grid */}
          <DatasetGrid
            categories={categories}
            isLoading={categoriesLoading}
          />
        </>
      )}
```

**Step 3: Verify the build**

Run: `cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add main/app/\(home\)/page.tsx
git commit -m "feat: add trending datasets grid to homepage"
```

---

### Task 5: Visual polish and dev verification

**Files:**
- Possibly modify: `main/app/(home)/_components/dataset-card.tsx`
- Possibly modify: `main/app/(home)/_components/dataset-grid.tsx`

**Step 1: Start the dev server and verify**

Run: `cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm dev`

Open `http://localhost:3000` in the browser and verify:
1. Hero section with search bar appears as before
2. Example pills appear below the hero
3. Below the pills, the "热门数据集" grid appears with dataset cards
4. Cards show: cover image (or gradient fallback), name, description, tags, size
5. Pinned datasets appear first
6. Responsive layout: 4 cols on desktop, 3 on tablet, 2 on small tablet, 1 on mobile
7. Clicking a card navigates to `/library`
8. Performing a search hides the grid and shows search results
9. Clearing search (navigating back to `/`) shows the grid again

**Step 2: Fix any visual issues found**

Adjust spacing, typography, or colors as needed to match the HF Spaces aesthetic.

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: homepage redesign with HF-style trending datasets grid"
```
