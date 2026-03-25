"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Search, Clock, X, SlidersHorizontal, ChevronDown, Check, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "@/i18n/navigation";
import Image from "next/image";
import { FloatingNav } from "@/components/layout/floating-nav";
import { MinimalFooter } from "./_components/minimal-footer";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import BorderGlow from "@/components/ui/border-glow";
import SplitText from "@/components/ui/split-text";
import TextType from "@/components/ui/text-type";
import { useSearchDropdown } from "@/lib/hooks/useSearchDropdown";
import { useAllCategories } from "@/lib/api/category";
import { useHotTerms } from "@/lib/api/public";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export default function HomePage() {
  const router = useRouter();
  const t = useTranslations("Home");
  const tc = useTranslations("Common");
  const tSearch = useTranslations("Search");

  const [query, setQuery] = useState("");
  const [selectedDataset, setSelectedDataset] = useState<string[]>(["all"]);
  const [datasetInputValue, setDatasetInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: categories } = useAllCategories();
  const allCategories = [
    { id: "all", name: "all", nickname: t("globalSearch") },
    ...(categories || []).filter((cat) => cat.if_in_all_data),
  ];
  const allCategory = allCategories.find((cat) => cat.name === "all");
  const specificCategories = allCategories.filter((cat) => cat.name !== "all");
  const isGlobal = selectedDataset.includes("all");

  const datasetLabel = allCategories
    .filter((cat) => selectedDataset.includes(cat.name))
    .map((cat) => cat.nickname ?? cat.name)
    .join(", ");

  const toggleDataset = (name: string) => {
    if (name === "all") {
      setSelectedDataset(["all"]);
      return;
    }
    const next = selectedDataset.includes(name)
      ? selectedDataset.filter((item) => item !== name)
      : [...selectedDataset.filter((item) => item !== "all"), name];
    setSelectedDataset(next.length ? next : ["all"]);
  };

  const navigateToSearch = useCallback(
    (term: string) => {
      if (!term.trim()) return;
      const params = new URLSearchParams();
      params.set("q", term.trim());
      params.set("dataset", selectedDataset.join(","));
      router.push(`/search?${params.toString()}`);
    },
    [router, selectedDataset],
  );

  const {
    showDropdown,
    mode,
    suggestions,
    history,
    activeIndex,
    wrapperRef,
    handleFocus,
    handleKeyDown: dropdownKeyDown,
    closeDropdown,
    selectItem,
    addToHistory,
    removeHistory,
    clearHistory,
  } = useSearchDropdown({ query, selectedDataset, onSearchTerm: navigateToSearch });

  const { data: hotTerms, refetch: refetchHotTerms, isFetching: hotTermsFetching, isLoading: hotTermsLoading } = useHotTerms();

  const handleManualSearch = () => {
    if (!query.trim()) return;
    addToHistory(query.trim());
    navigateToSearch(query);
    closeDropdown();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (showDropdown && activeIndex >= 0) {
        dropdownKeyDown(e); // select from dropdown
      } else {
        handleManualSearch();
      }
      return;
    }
    dropdownKeyDown(e); // ↑↓ Escape
  };

  const hasDropdown = showDropdown && (mode === "history" ? history.length > 0 : suggestions.length > 0);

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Background gradient */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, oklch(0.95 0.02 256 / 0.08), transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 z-0 hidden dark:block"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, oklch(0.20 0.03 256 / 0.15), transparent 70%)",
        }}
      />

      {/* FloatingNav */}
      <FloatingNav />

      {/* Main content - positioned slightly above center like Google */}
      <main className="relative z-10 flex flex-1 flex-col items-center px-4 pt-[15svh] md:pt-[18vh]">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <Image
            src="/logo.png"
            alt="DimSum Logo"
            width={52}
            height={52}
            priority
          />
        </motion.div>

        {/* Title */}
        <SplitText
          text="DimSum AI Labs"
          tag="h1"
          className="mt-3 text-2xl md:text-3xl font-semibold text-foreground"
          delay={40}
          duration={0.6}
          ease="power3.out"
          splitType="chars"
          from={{ opacity: 0, y: 20 }}
          to={{ opacity: 1, y: 0 }}
          threshold={0.1}
          rootMargin="0px"
          textAlign="center"
        />

        {/* Subtitle — typing effect */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="mt-1.5 h-6 w-full max-w-[720px] text-center"
        >
          <TextType
            text={[
              t("typingTexts_0"),
              t("typingTexts_1"),
              t("typingTexts_2"),
              t("typingTexts_3"),
            ]}
            className="text-sm text-muted-foreground"
            typingSpeed={60}
            deletingSpeed={30}
            pauseDuration={2000}
            showCursor
            cursorCharacter="|"
            cursorClassName="text-muted-foreground/50"
            cursorBlinkDuration={0.6}
            loop
          />
        </motion.div>

        {/* Search bar + dropdown wrapper */}
        <motion.div
          ref={wrapperRef as React.RefObject<HTMLDivElement>}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="relative mt-6 w-full max-w-[720px]"
        >
          {/* Search card with border glow — dropdown is inside the same card */}
          <BorderGlow
            borderRadius={16}
            glowRadius={30}
            glowIntensity={0.8}
            edgeSensitivity={25}
            coneSpread={30}
            fillOpacity={0.3}
            glowColor="210 80 70"
            backgroundColor="var(--background)"
            colors={["#3193ff", "#007fff", "#5aa8ff"]}
            className="w-full"
          >
            <div className="px-2.5 py-2">
              {/* Input row */}
              <div className="flex items-center h-11">
                <Search className="h-4 w-4 text-muted-foreground mr-2.5 flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={handleFocus}
                  placeholder={t("searchPlaceholder")}
                  className="flex-1 h-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>

              {/* Button row */}
              <div className="flex items-center justify-end gap-2 mt-2.5">
                {/* Dataset selector */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-1.5 text-xs text-muted-foreground h-9 px-3 max-w-[200px]"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={datasetLabel}
                          initial={{ opacity: 0, y: 3 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -3 }}
                          transition={{ duration: 0.12 }}
                          className="truncate"
                        >
                          {datasetLabel || tSearch("selectDataset")}
                        </motion.span>
                      </AnimatePresence>
                      <ChevronDown className="h-3 w-3 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[220px] p-0" align="end">
                    <Command className="bg-background!">
                      <CommandInput
                        placeholder={tSearch("searchDatasetPlaceholder")}
                        value={datasetInputValue}
                        onValueChange={setDatasetInputValue}
                      />
                      <CommandList>
                        <CommandGroup>
                          {allCategory && (
                            <CommandItem
                              value={allCategory.nickname ?? allCategory.name}
                              onSelect={() => toggleDataset("all")}
                              className="cursor-pointer"
                            >
                              <motion.div
                                animate={{ scale: isGlobal ? 1 : 0.5, opacity: isGlobal ? 1 : 0 }}
                                transition={{ duration: 0.15 }}
                                className="h-4 w-4 flex items-center justify-center shrink-0"
                              >
                                <Check className="h-3.5 w-3.5 text-primary" />
                              </motion.div>
                              {allCategory.nickname ?? allCategory.name}
                            </CommandItem>
                          )}
                        </CommandGroup>
                        {specificCategories.length > 0 && (
                          <motion.div
                            animate={{ opacity: isGlobal ? 0.45 : 1 }}
                            transition={{ duration: 0.2 }}
                          >
                            <CommandGroup heading={tSearch("orSelectSpecific")}>
                              {specificCategories.map((cat) => (
                                <CommandItem
                                  key={cat.id}
                                  value={cat.nickname ?? cat.name}
                                  onSelect={() => toggleDataset(cat.name)}
                                  className="cursor-pointer"
                                >
                                  <motion.div
                                    animate={{
                                      scale: selectedDataset.includes(cat.name) ? 1 : 0.5,
                                      opacity: selectedDataset.includes(cat.name) ? 1 : 0,
                                    }}
                                    transition={{ duration: 0.15 }}
                                    className="h-4 w-4 flex items-center justify-center shrink-0"
                                  >
                                    <Check className="h-3.5 w-3.5 text-primary" />
                                  </motion.div>
                                  <span className="truncate">{cat.nickname ?? cat.name}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </motion.div>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                <Button
                  onClick={handleManualSearch}
                  className="h-9 px-6 rounded-lg text-sm font-medium"
                >
                  {t("searchButton")}
                </Button>
              </div>
            </div>

            {/* Dropdown — history or suggestions, inline within the same card */}
            <AnimatePresence>
              {hasDropdown && (
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="mx-4 border-t" />

                  {mode === "history" ? (
                    <>
                      <div className="flex items-center justify-between px-4 pt-2 pb-1">
                        <span className="text-xs font-medium text-muted-foreground">{tSearch("recentSearches")}</span>
                        <button
                          onMouseDown={(e) => { e.preventDefault(); clearHistory(); }}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {tSearch("clearHistory")}
                        </button>
                      </div>
                      <ul className="py-1">
                        {history.map((term, idx) => (
                          <li
                            key={term}
                            className={cn(
                              "flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm transition-colors group",
                              activeIndex === idx ? "bg-accent" : "hover:bg-accent/50",
                            )}
                          >
                            <button
                              className="flex flex-1 min-w-0 items-center gap-3 text-left"
                              onMouseDown={(e) => { e.preventDefault(); selectItem(term); }}
                            >
                              <Clock className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                              <span className="flex-1 truncate text-foreground">{term}</span>
                            </button>
                            <button
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity shrink-0"
                              onMouseDown={(e) => { e.preventDefault(); removeHistory(term); }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <ul className="py-1">
                      {suggestions.map((item, idx) => (
                        <li
                          key={item.id}
                          onMouseDown={(e) => { e.preventDefault(); selectItem(item.data); }}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                            activeIndex === idx ? "bg-accent" : "hover:bg-accent/50",
                          )}
                        >
                          <Search className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                          <span className="flex-1 truncate text-foreground">{item.data}</span>
                          <span className="flex-shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {item.category}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </BorderGlow>
        </motion.div>

        {/* Hot search pills */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mt-6 flex w-full max-w-[720px] flex-wrap items-center gap-2"
        >
          <span className="text-xs font-medium text-muted-foreground">
            {t("trending")}
          </span>
          {hotTermsLoading ? (
            [72, 48, 96, 56, 80, 40].map((w, i) => (
              <div
                key={i}
                className="skeleton-shimmer h-7 rounded-full"
                style={{ width: w }}
              />
            ))
          ) : (
            <>
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
                <RefreshCw aria-hidden="true" className={cn("h-3 w-3", hotTermsFetching && "animate-spin")} />
                {t("luckyButton")}
              </button>
            </>
          )}
        </motion.div>


      </main>

      {/* Footer */}
      <div className="relative z-10">
        <MinimalFooter />
      </div>
    </div>
  );
}
