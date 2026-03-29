# Dynamic Hot Terms Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the hardcoded `HOT_TERMS` on the homepage with random corpus terms fetched via a new API route, and add a "试试手气" button to manually refresh them.

**Architecture:** New `GET /api/public/hot-terms` route uses Prisma `$queryRaw` to select random rows from `cantonese_corpus_all`. A `useHotTerms()` hook (TanStack Query, 1-day cache) fetches the data. The homepage calls `refetch()` when the user clicks "试试手气".

**Tech Stack:** Next.js 15 App Router, Prisma (PostgreSQL/Supabase), TanStack Query (`useQuery`), Tailwind CSS, lucide-react

---

### Task 1: API Route — `GET /api/public/hot-terms`

**Files:**
- Create: `app/api/public/hot-terms/route.ts`

**Step 1: Create the route file**

```typescript
// app/api/public/hot-terms/route.ts
import { NextRequest, NextResponse } from "next/server";
import { publicApi } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  return publicApi(req, async () => {
    const { searchParams } = new URL(req.url);
    const count = Math.min(parseInt(searchParams.get("count") ?? "6", 10), 20);

    const rows = await prisma.$queryRaw<Array<{ data: string }>>(
      Prisma.sql`SELECT data FROM cantonese_corpus_all ORDER BY RANDOM() LIMIT ${count}`
    );

    return NextResponse.json({ terms: rows.map((r) => r.data) });
  });
}
```

**Step 2: Manually verify the endpoint**

Start dev server (`pnpm dev` from `main/`), then open:
```
http://localhost:3000/api/public/hot-terms
http://localhost:3000/api/public/hot-terms?count=3
```
Expected: `{ "terms": ["...", "...", "..."] }` — different values on each refresh.

**Step 3: Commit**

```bash
git add app/api/public/hot-terms/route.ts
git commit -m "feat: add GET /api/public/hot-terms route"
```

---

### Task 2: Frontend Hook — `useHotTerms`

**Files:**
- Modify: `lib/api/public.ts`

**Step 1: Add the hook to `lib/api/public.ts`**

Append after the existing `useBasicInfo` function:

```typescript
export function useHotTerms(count = 6) {
  return useQuery<string[]>({
    queryKey: ["hotTerms"],
    queryFn: () =>
      api
        .get<{ terms: string[] }>(`/api/public/hot-terms?count=${count}`)
        .then((r) => r.terms),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd main && pnpm build 2>&1 | grep -E "error|warning" | head -20
```
Expected: no TypeScript errors related to the new hook.

**Step 3: Commit**

```bash
git add lib/api/public.ts
git commit -m "feat: add useHotTerms hook"
```

---

### Task 3: UI — Wire up hook and add "试试手气" button

**Files:**
- Modify: `app/[locale]/(home)/page.tsx`

**Step 1: Remove hardcoded terms and import the hook**

Remove this line at the top of the file:
```typescript
const HOT_TERMS = ["落花流水", "唔听", "行", "姐姐", "歡聚一堂", "帆船"];
```

Add to the imports (alongside the existing `useAllCategories` import or near other hook imports):
```typescript
import { useHotTerms } from "@/lib/api/public";
```

**Step 2: Call the hook inside `HomePage`**

Add inside the component body, near the other hook calls (after `useSearchDropdown`):
```typescript
const { data: hotTerms, refetch: refetchHotTerms, isFetching: hotTermsFetching } = useHotTerms();
```

**Step 3: Replace the hot search pills section**

Find and replace the entire `{/* Hot search pills */}` motion.div block (currently lines ~403–421):

```tsx
{/* Hot search pills */}
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5, delay: 0.25 }}
  className="mt-6 flex flex-wrap items-center justify-center gap-2"
>
  <span className="mr-1 text-xs font-medium text-muted-foreground">
    {t("trending")}
  </span>
  {(hotTerms ?? []).map((term) => (
    <button
      key={term}
      onClick={() => navigateToSearch(term)}
      className="rounded-full border px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
    >
      {term}
    </button>
  ))}
  <button
    onClick={() => refetchHotTerms()}
    disabled={hotTermsFetching}
    className="flex items-center gap-1 rounded-full border px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary disabled:opacity-50"
  >
    <RefreshCw className={cn("h-3 w-3", hotTermsFetching && "animate-spin")} />
    {t("luckyButton")}
  </button>
</motion.div>
```

**Step 4: Add `RefreshCw` to the lucide-react import**

Find the existing lucide import line:
```typescript
import { Search, Clock, X, SlidersHorizontal, ChevronDown, Check } from "lucide-react";
```
Add `RefreshCw`:
```typescript
import { Search, Clock, X, SlidersHorizontal, ChevronDown, Check, RefreshCw } from "lucide-react";
```

**Step 5: Add the i18n key `luckyButton`**

Find the translation files (likely `messages/zh-HK.json`, `messages/zh-CN.json`, `messages/en.json` or similar). In the `Home` namespace, add:
```json
"luckyButton": "試試手氣"
```
(Adjust the text per locale: `"试试手气"` for zh-CN, `"I'm Feeling Lucky"` for en.)

> **Finding translation files:** Run `find . -name "*.json" -path "*/messages/*" | grep -v node_modules` from `main/` to locate them.

**Step 6: Verify in browser**

1. Open `http://localhost:3000` — hot terms should appear (different from the old hardcoded ones)
2. Click "试试手气" — pills should briefly spin and update to a new random set
3. Navigate away and back within 1 day — same terms should appear (cached)

**Step 7: Commit**

```bash
git add app/[locale]/\(home\)/page.tsx
git add messages/  # include all locale files you modified
git commit -m "feat: dynamic hot terms with refresh button on homepage"
```

---

## Done

All three tasks complete. The feature is:
- `GET /api/public/hot-terms` — returns N random corpus terms
- `useHotTerms()` — 1-day cached TanStack Query hook
- Homepage — renders dynamic pills + "试试手气" refresh button
