# Search Results Page Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the search results page into a Google/Baidu-style flat layout with sticky header, horizontal category tabs, and flat collapsible result items.

**Architecture:** Three focused changes: (1) new `CategoryTabs` replacing the popover-based `CategorySelector`; (2) new `SearchResultItem` replacing both `WordLyricCardDetail` and `YueSongCardDetail` with flat collapsible-media design; (3) rewrite of `page.tsx` layout skeleton preserving all business logic. Two new i18n keys added.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS v4, `motion/react` (already in use), shadcn/ui, `next-intl`

---

## Task 1: Add i18n keys

**Files:**
- Modify: `messages/zh-CN.json`
- Modify: `messages/en.json`

**Step 1: Add new keys to zh-CN.json**

Open `messages/zh-CN.json`. Inside the `"Search"` object, add:

```json
"resultCount": "找到约 {count} 条结果",
"expandContent": "展开",
"collapseContent": "收起",
"prevPage": "上一页",
"nextPage": "下一页"
```

**Step 2: Add new keys to en.json**

Open `messages/en.json`. Inside the `"Search"` object, add:

```json
"resultCount": "About {count} results",
"expandContent": "Expand",
"collapseContent": "Collapse",
"prevPage": "Previous",
"nextPage": "Next"
```

**Step 3: Verify**

Run `pnpm dev` in `/Users/fun/Documents/GitHub/dimsum-app/main`. No TypeScript errors expected.

**Step 4: Commit**

```bash
git add messages/zh-CN.json messages/en.json
git commit -m "feat(search): add i18n keys for redesigned search results page"
```

---

## Task 2: Create CategoryTabs component

**Files:**
- Create: `app/[locale]/(home)/_components/category-tabs.tsx`

**Step 1: Create the file**

```tsx
"use client";

import { cn } from "@/lib/utils";
import { type SearchResult } from "@/lib/api/search";
import { useMemo } from "react";

interface CategoryTabsProps {
  results: SearchResult[];
  selectedCategory: string;
  onSelect: (category: string) => void;
  selectedDataset: string[];
}

export default function CategoryTabs({
  results,
  selectedCategory,
  onSelect,
  selectedDataset,
}: CategoryTabsProps) {
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    results?.forEach((r) => {
      map.set(r.category, (map.get(r.category) ?? 0) + 1);
    });
    return [...map.entries()];
  }, [results]);

  // Same visibility condition as the old CategorySelector
  if (!(selectedDataset.length > 1 || selectedDataset[0] === "all")) {
    return null;
  }

  const tabs = [
    { label: "全部", value: "全部", count: results.length },
    ...categories.map(([cat, count]) => ({ label: cat, value: cat, count })),
  ];

  return (
    <div className="border-b border-border bg-background">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => onSelect(tab.value)}
              className={cn(
                "shrink-0 px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors duration-150",
                selectedCategory === tab.value
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              <span className="ml-1 text-xs opacity-60">({tab.count})</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify no TypeScript errors**

Run: `pnpm build` (or open in editor and check for red underlines). No errors expected.

**Step 3: Commit**

```bash
git add "app/[locale]/(home)/_components/category-tabs.tsx"
git commit -m "feat(search): add CategoryTabs horizontal tab component"
```

---

## Task 3: Create SearchResultItem component

This component replaces both `WordLyricCardDetail` and `YueSongCardDetail` with a flat, collapsible-media design.

**Files:**
- Create: `app/[locale]/(home)/_components/search-result-item.tsx`

**Step 1: Create the file**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { type SearchResult } from "@/lib/api/search";
import { type DictionaryNote } from "@/lib/types";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CirclePlay, Share2, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "@/i18n/navigation";
import { corpusInteractApi } from "@/lib/api/corpus-interact";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ReactPlayer from "react-player";
import { cn } from "@/lib/utils";

// ─── Helpers (copied from original components) ───────────────────────────────

function isImageUrl(url: string): boolean {
  if (typeof url !== "string") return false;
  const exts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"];
  const lower = url.toLowerCase();
  return exts.some((e) => lower.endsWith(e)) || lower.includes("image");
}

function isAudioByExt(url: string): boolean {
  return /\.(mp3|wav|ogg|aac|flac|m4a|opus)(\?.*)?$/i.test(url);
}

function isDictionaryNote(note: SearchResult["note"]): note is DictionaryNote {
  return !Array.isArray(note) && typeof note === "object" && note !== null && "context" in note;
}

/** Extract a short plain-text snippet from result.note for the collapsed preview */
function getSnippet(note: SearchResult["note"]): string | null {
  if (!note) return null;
  if (typeof note === "string" && !isImageUrl(note) && !isAudioByExt(note)) {
    return note;
  }
  if (Array.isArray(note)) {
    const text = note
      .filter((i) => typeof i === "string" && !isImageUrl(i) && !isAudioByExt(i))
      .join(" ");
    return text || null;
  }
  if (typeof note === "object" && "context" in note) {
    const ctx = (note as { context: Record<string, unknown> }).context;
    if (typeof ctx.meaning === "string") return ctx.meaning;
    if (Array.isArray(ctx.meaning)) return ctx.meaning.join("、");
    if (typeof ctx.introduction === "string") return ctx.introduction;
    if (typeof ctx.subtitle === "string") return ctx.subtitle;
    const first = Object.values(ctx).find(
      (v) => typeof v === "string" && !isImageUrl(v) && !isAudioByExt(v)
    );
    return (first as string) ?? null;
  }
  return null;
}

/** Check if a note has any expandable rich content worth showing */
function hasRichContent(note: SearchResult["note"]): boolean {
  if (!note) return false;
  if (typeof note === "string") return true;
  if (Array.isArray(note) && note.length > 0) return true;
  if (typeof note === "object" && "context" in note) return true;
  return false;
}

// ─── Edit permission hook (copied from WordLyricCardDetail) ──────────────────

function useCanEdit(result: SearchResult, user: any): boolean {
  if (!user) return false;
  if (result.editable_level === 0) return false;
  if (result.editable_level === 1) {
    return user.role === "TAGGER_PARTNER" || user.role === "TAGGER_OUTSOURCING";
  }
  return true;
}

// ─── Related links sub-component ─────────────────────────────────────────────

function RelatedLinks({
  title,
  links,
  uniqueId,
}: {
  title: string;
  links: { name: string; url: string; description?: string }[];
  uniqueId: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">{title}:</span>
      {links.map((link) => (
        <TooltipProvider key={link.name}>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={link.url.replace("{item.unique_id}", uniqueId)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium border border-primary/20 hover:bg-primary/20 transition-colors"
              >
                {link.name}
              </a>
            </TooltipTrigger>
            {link.description && (
              <TooltipContent>
                <p>{link.description}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}

// ─── Expanded note content ────────────────────────────────────────────────────

function NoteContent({ result }: { result: SearchResult }) {
  const t = useTranslations("Search");
  const note = result.note;

  if (!note) return null;

  // Dictionary note (广州话正音字典)
  if (result.category === "广州话正音字典" && isDictionaryNote(note)) {
    return (
      <div className="space-y-2 text-sm">
        {note.context.meaning && (
          <p>
            <b className="text-primary">{t("meaning")}：</b>
            {Array.isArray(note.context.meaning)
              ? note.context.meaning.join("、")
              : note.context.meaning}
          </p>
        )}
        {note.context.pinyin && (
          <p>
            <b className="text-primary">{t("pinyin")}：</b>
            {Array.isArray(note.context.pinyin)
              ? note.context.pinyin.join("、")
              : note.context.pinyin}
          </p>
        )}
        {note.context.contributor && (
          <p>
            <b className="text-primary">{t("contributor")}：</b>
            {note.context.contributor}
          </p>
        )}
        {note.context.page && (
          <p>
            <b className="text-primary">{t("pageNumber")}：</b>
            {note.context.page}
          </p>
        )}
        {note.context.number && (
          <p>
            <b className="text-primary">{t("number")}：</b>
            {note.context.number}
          </p>
        )}
      </div>
    );
  }

  // String note
  if (typeof note === "string") {
    if (isImageUrl(note)) {
      return (
        <img
          src={note}
          alt="Note image"
          className="max-w-full h-auto rounded-lg"
          loading="lazy"
        />
      );
    }
    return <p className="text-sm leading-relaxed">{note}</p>;
  }

  // Array note
  if (Array.isArray(note)) {
    return (
      <div className="space-y-2">
        {note.map((item, idx) =>
          typeof item === "string" && isImageUrl(item) ? (
            <img
              key={idx}
              src={item}
              alt={`Note image ${idx + 1}`}
              className="max-w-full h-auto rounded-lg"
              loading="lazy"
            />
          ) : (
            <p key={idx} className="text-sm leading-relaxed">
              {String(item)}
            </p>
          )
        )}
      </div>
    );
  }

  // Object with context
  if (typeof note === "object" && "context" in note) {
    const ctx = (note as { context: Record<string, unknown> }).context;

    // Video note
    if (ctx.video && typeof ctx.video === "string") {
      return (
        <div className="space-y-3">
          <div className="relative pt-[56.25%] rounded-lg overflow-hidden">
            <ReactPlayer
              url={ctx.video}
              playing={false}
              controls
              width="100%"
              height="100%"
              className="absolute top-0 left-0"
              config={{ file: { attributes: { controlsList: "nodownload", disablePictureInPicture: true } } }}
            />
          </div>
          {ctx.subtitle && (
            <p className="text-sm leading-relaxed">
              <b className="text-primary">{t("subtitles")}:</b>{" "}
              {ctx.subtitle as string}
            </p>
          )}
        </div>
      );
    }

    // Generic context object
    return (
      <div className="space-y-2 text-sm">
        {Object.entries(ctx)
          .filter(([key]) => key !== "video" && key !== "subtitle")
          .map(([key, value]) => {
            if (!value) return null;
            const label = key.charAt(0).toUpperCase() + key.slice(1);
            if (Array.isArray(value)) {
              return (
                <p key={key}>
                  <b className="text-primary">{label}:</b> {value.join(", ")}
                </p>
              );
            }
            if (typeof value === "string") {
              if (isAudioByExt(value)) {
                return (
                  <div key={key} className="space-y-1">
                    <b className="text-primary">{label}:</b>
                    <ReactPlayer
                      url={value}
                      playing={false}
                      controls
                      height="100px"
                      width="100%"
                      config={{ file: { attributes: { controlsList: "nodownload", disablePictureInPicture: true } } }}
                    />
                  </div>
                );
              }
              if (isImageUrl(value)) {
                return (
                  <div key={key}>
                    <b className="text-primary">{label}:</b>
                    <img src={value} alt={label} className="max-w-full h-auto rounded-lg mt-1" loading="lazy" />
                  </div>
                );
              }
              if (key === "link" || key === "链接") {
                return (
                  <p key={key}>
                    <b className="text-primary">{label}:</b>{" "}
                    <a href={value} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                      {value}
                    </a>
                  </p>
                );
              }
              if (value.startsWith("http") && !isAudioByExt(value)) {
                return (
                  <div key={key}>
                    <b className="text-primary">{label}:</b>
                    <iframe src={value} title={label} className="w-full h-64 rounded border mt-1" allowFullScreen />
                  </div>
                );
              }
              return (
                <p key={key}>
                  <b className="text-primary">{label}:</b>{" "}
                  <span className="whitespace-pre-line">{value}</span>
                </p>
              );
            }
            return null;
          })}
      </div>
    );
  }

  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SearchResultItem({
  result,
  setEditingResult,
  setUpdateDialogOpen,
}: {
  result: SearchResult;
  setEditingResult: React.Dispatch<React.SetStateAction<SearchResult | null>>;
  setUpdateDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [expanded, setExpanded] = useState(false);
  const { user } = useAuthStore();
  const canEdit = useCanEdit(result, user);
  const t = useTranslations("Search");
  const router = useRouter();

  const { data: categoryData } = useQuery({
    queryKey: ["corpusCategory", result.category_name],
    queryFn: () =>
      fetch(
        process.env.NEXT_PUBLIC_BACKEND_URL +
          `/v2/corpus_category?name=${result.category_name}`
      ).then((res) => res.json()),
    staleTime: 60 * 1000,
  });

  const related = categoryData?.related ?? null;
  const snippet = getSnippet(result.note);
  const richContent = hasRichContent(result.note);

  // ── YueSong variant ──────────────────────────────────────────────────────
  if (result.category === "粤语曲库") {
    return (
      <div className="py-5 border-b border-border last:border-0">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-primary leading-snug">
              {result.note.context.song_name}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {result.note.context.author}
              {result.note.context.album && ` · ${result.note.context.album}`}
            </p>
            {result.note.context.introduction && (
              <p className="text-sm text-foreground mt-1.5 line-clamp-2">
                {result.note.context.introduction}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded border border-primary/20">
                {result.category}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 text-primary">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                corpusInteractApi.updateView(result.unique_id);
                router.push(`/yueSong?id=${result.unique_id}`);
              }}
            >
              <CirclePlay className="h-4 w-4" />
            </Button>
            <a
              href={`https://card.app.aidimsum.com/?uuid=${result.unique_id}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                const url = e.currentTarget.href;
                navigator.clipboard.writeText(url).then(() => toast("Link copied."));
              }}
            >
              <Button variant="ghost" size="sm" asChild>
                <span>
                  <Share2 className="h-4 w-4" />
                </span>
              </Button>
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── WordLyric variant (all other categories) ─────────────────────────────
  return (
    <div className="py-5 border-b border-border last:border-0">
      {/* Title row */}
      <div className="flex justify-between items-start gap-4">
        <h3 className="text-lg font-semibold text-primary leading-snug flex-1 min-w-0">
          {result.data}
        </h3>
        <div className="flex items-center gap-1 shrink-0">
          {richContent && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((v) => !v)}
              className="text-muted-foreground hover:text-foreground"
            >
              {expanded ? (
                <><ChevronUp className="h-4 w-4 mr-1" />{t("collapseContent")}</>
              ) : (
                <><ChevronDown className="h-4 w-4 mr-1" />{t("expandContent")}</>
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
              编辑
            </Button>
          )}
        </div>
      </div>

      {/* Snippet (collapsed preview) */}
      {!expanded && snippet && (
        <p className="text-sm text-foreground mt-1.5 line-clamp-3 leading-relaxed">
          {snippet}
        </p>
      )}

      {/* Expanded content */}
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

      {/* Tags row */}
      <div className="flex flex-wrap gap-1.5 mt-2.5">
        <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded border border-primary/20">
          {result.category}
        </span>
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
}
```

**Step 2: Verify no TypeScript errors**

Open the file in editor or run `pnpm build`. Fix any type errors before committing.

**Step 3: Commit**

```bash
git add "app/[locale]/(home)/_components/search-result-item.tsx"
git commit -m "feat(search): add SearchResultItem flat collapsible result component"
```

---

## Task 4: Rewrite page.tsx layout

This task preserves all state/logic from the current `page.tsx` and only changes the visual structure.

**Files:**
- Modify: `app/[locale]/(home)/search/page.tsx`

**Step 1: Replace imports**

At the top of `page.tsx`, **remove** these imports:
```tsx
import { Card } from "@/components/ui/card";
import { EditCorpusDialog } from "@/components/dialogs/edit-corpus-dialog";  // keep this
import WordLyricCardDetail from "../_components/word-lyric-card-detail";     // REMOVE
import YueSongCardDetail from "../_components/yue-song-card-detail";         // REMOVE
import CategorySelector from "../_components/category-selector";             // REMOVE
```

**Add** these imports:
```tsx
import SearchResultItem from "../_components/search-result-item";
import CategoryTabs from "../_components/category-tabs";
import { ChevronDown, Home } from "lucide-react";
import { Link } from "@/i18n/navigation";  // already imported, keep
```

**Step 2: Replace the return JSX**

Replace the entire `return (...)` block with the following. All state variables and handlers above `return` remain unchanged.

```tsx
  return (
    <>
      {/* ── Sticky search header ───────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="container mx-auto px-4 max-w-5xl h-14 flex items-center gap-3">
          {/* Logo */}
          <Link
            href="/"
            className="font-bold text-primary text-base shrink-0 hidden sm:block"
          >
            点心探索
          </Link>
          <Link href="/" className="shrink-0 sm:hidden">
            <Home className="h-5 w-5 text-primary" />
          </Link>

          {/* Search input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-muted-foreground" />
            </div>
            <Input
              placeholder={th("searchPlaceholder")}
              value={searchPrompt}
              onChange={(e) => setSearchPrompt(e.target.value)}
              onKeyDown={handleKeyPress}
              className="pl-9 h-9 text-sm dark:text-accent-foreground dark:placeholder:text-accent-foreground dark:bg-background"
            />
          </div>

          {/* Dataset selector */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground shrink-0 max-w-[140px]"
              >
                <span className="truncate">
                  {(fiter_not_in || [])
                    .map((cat) =>
                      selectedDataset.includes(cat.name)
                        ? cat.nickname || cat.name
                        : null
                    )
                    .filter(Boolean)
                    .join(", ") || t("selectDataset")}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
              <Command className="bg-background!">
                <CommandInput
                  placeholder={t("searchDatasetPlaceholder")}
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
                        onChange={() => {
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
            onClick={handleSearch}
            disabled={isPending}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
          >
            {isPending ? t("searching") : th("searchButton")}
          </Button>
        </div>
      </header>

      {/* ── Category tabs ──────────────────────────────────────────────── */}
      {results && results.length > 0 && (
        <CategoryTabs
          results={results}
          selectedCategory={selectCategory}
          onSelect={(cat) => {
            setSelectCategory(cat);
            setCurrentPage(1);
          }}
          selectedDataset={selectedDataset}
        />
      )}

      {/* ── Loading skeletons ──────────────────────────────────────────── */}
      {isPending && (
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="py-5 border-b border-border">
              <Skeleton className="h-5 w-2/5 mb-2" />
              <Skeleton className="h-4 w-full mb-1.5" />
              <Skeleton className="h-4 w-4/5 mb-3" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded" />
                <Skeleton className="h-5 w-14 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Results ────────────────────────────────────────────────────── */}
      {results && results.length > 0 && (
        <div className="container mx-auto px-4 py-4 max-w-4xl">
          {/* Result count */}
          <p className="text-sm text-muted-foreground mb-1">
            {t("resultCount", { count: filteredResults.length })}
          </p>

          {/* Result items */}
          <AnimatePresence mode="wait">
            <motion.div
              key={selectCategory}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {currentResults.map((result, index) => (
                <motion.div
                  key={result.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.35,
                    delay: index * 0.06,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <SearchResultItem
                    result={result}
                    setEditingResult={setEditingResult}
                    setUpdateDialogOpen={setUpdateDialogOpen}
                  />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>

          {/* ── Pagination ──────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-1 mt-8 text-sm">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {t("prevPage")}
              </button>

              {getPageNumbers().map((page, idx) =>
                page === "..." ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-2 py-1.5 text-muted-foreground"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page as number)}
                    className={cn(
                      "px-3 py-1.5 rounded transition-colors",
                      currentPage === page
                        ? "font-bold text-primary"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {page}
                  </button>
                )
              )}

              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {t("nextPage")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── No results ─────────────────────────────────────────────────── */}
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
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2 text-sm">
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
                    className="text-primary hover:underline"
                  >
                    {example.title}「{example.prompt}」
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Edit dialog (unchanged) ─────────────────────────────────────── */}
      <EditCorpusDialog
        open={updateDialogOpen}
        onOpenChange={setUpdateDialogOpen}
        editingResult={editingResult}
      />
    </>
  );
```

**Step 3: Remove unused imports**

After replacing the JSX, check and remove any imports that are no longer used (e.g., `Card` if it was only used in the old layout). TypeScript will flag them.

**Step 4: Verify**

Run `pnpm dev`. Open the search page at `http://localhost:3000/zh-CN/search?q=落花流水`.

Check:
- [ ] Sticky header appears with logo, search input, dataset selector, search button
- [ ] Category tabs appear when multiple categories in results
- [ ] Results show flat items with title, snippet, and expand button
- [ ] Clicking "展开" reveals full content with animation
- [ ] Tags / category badges visible below snippet
- [ ] Pagination shows text-style prev/next with page numbers
- [ ] No results page shows simplified empty state with text links
- [ ] Loading skeletons match flat item dimensions
- [ ] Dark mode works correctly

**Step 5: Commit**

```bash
git add "app/[locale]/(home)/search/page.tsx"
git commit -m "feat(search): redesign search results page to Google/Baidu flat layout"
```

---

## Done

All four tasks complete. The search results page now has:
- Sticky compact header
- Horizontal scrollable category tabs with counts
- Flat result items with collapsible rich media
- Text-style pagination
- Simplified no-results empty state

Old components (`WordLyricCardDetail`, `YueSongCardDetail`, `CategorySelector`) are untouched and still available if used elsewhere.
