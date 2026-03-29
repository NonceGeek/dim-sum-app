# Dynamic Hot Terms Design

Date: 2026-03-25

## Overview

Replace the hardcoded `HOT_TERMS` array on the homepage with dynamically fetched random terms from the corpus, and add a "试试手气" button to manually refresh the list.

## Requirements

- Hot terms are randomly sampled from `cantonese_corpus_all` on every page load (after cache expires)
- Terms are cached client-side for 1 day; the user can force-refresh via "试试手气"
- "试试手气" refreshes the hot term pills with a new random set (does not navigate)

## Architecture

### Backend: New API Route

**`app/api/public/hot-terms/route.ts`**

- Method: `GET`
- Query param: `count` (default 6, max 20)
- Response: `{ terms: string[] }`
- Auth: public (`publicApi` wrapper)
- Implementation: Prisma `$queryRaw` with `ORDER BY RANDOM() LIMIT $count` on `cantonese_corpus_all`

```
GET /api/public/hot-terms?count=6
→ { "terms": ["落花流水", "唔听", "行", "姐姐", "歡聚一堂", "帆船"] }
```

> **Performance note**: `ORDER BY RANDOM()` does a full table scan on large tables. If `cantonese_corpus_all` grows beyond ~100k rows and latency becomes a concern, consider switching to `TABLESAMPLE SYSTEM(1)` + LIMIT or a random-offset approach.

### Frontend: TanStack Query Hook

Add `useHotTerms(count?: number)` to **`lib/api/public.ts`**:

```typescript
export function useHotTerms(count = 6) {
  return useQuery<string[]>({
    queryKey: ["hotTerms"],
    queryFn: () =>
      api.get<{ terms: string[] }>(`/api/public/hot-terms?count=${count}`)
         .then(r => r.terms),
    staleTime: 24 * 60 * 60 * 1000,  // 1 day
    gcTime: 24 * 60 * 60 * 1000,     // must match staleTime to avoid early eviction
    refetchOnWindowFocus: false,
  });
}
```

### UI: `app/[locale]/(home)/page.tsx`

- Remove `const HOT_TERMS = [...]`
- Call `const { data: hotTerms, refetch: refetchHotTerms, isFetching } = useHotTerms()`
- Render pills from `hotTerms ?? []`
- Add "试试手气" button after the pills that calls `refetchHotTerms()`; show a spinning icon while `isFetching`

Layout:
```
热搜：[词1] [词2] [词3] [词4] [词5] [词6]  ↺ 试试手气
```

## Caching Behavior

| Scenario | Behavior |
|---|---|
| First page visit | Fetches random terms from API |
| Return within 1 day | Serves from TanStack Query memory cache |
| Click "试试手气" | `refetch()` bypasses staleTime, forces new request |
| Return after 1 day | Cache expired, fetches new random terms |

## Files Changed

| File | Change |
|---|---|
| `app/api/public/hot-terms/route.ts` | New file |
| `lib/api/public.ts` | Add `useHotTerms` hook |
| `app/[locale]/(home)/page.tsx` | Replace `HOT_TERMS` with hook + add "试试手气" button |
