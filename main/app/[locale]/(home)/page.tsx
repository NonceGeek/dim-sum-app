"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useSearch, type SearchResult } from "@/lib/api/search";
import { Search, BarChart3, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "@/i18n/navigation";
import Image from "next/image";
import { FloatingNav } from "@/components/layout/floating-nav";
import { MinimalFooter } from "./_components/minimal-footer";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const HOT_TERMS = ["落花流水", "唔听", "行", "姐姐", "歡聚一堂", "帆船"];

export default function HomePage() {
  const router = useRouter();
  const { mutate: search } = useSearch();
  const t = useTranslations("Home");
  const tc = useTranslations("Common");

  // --- state ---
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);

  // --- refs ---
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- navigate to search results page ---
  const navigateToSearch = useCallback(
    (term: string) => {
      if (!term.trim()) return;
      const params = new URLSearchParams();
      params.set("q", term.trim());
      params.set("dataset", t("globalSearch"));
      router.push(`/search?${params.toString()}`);
    },
    [router],
  );

  // --- debounced suggestion fetch ---
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      search(
        { keyword: query.trim(), category: JSON.stringify(["all"]) },
        {
          onSuccess: (data) => {
            setSuggestions(data.slice(0, 6));
            setShowDropdown(data.length > 0);
            setActiveIndex(-1);
          },
          onError: () => {
            setSuggestions([]);
            setShowDropdown(false);
          },
        },
      );
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  // --- click-outside to close dropdown ---
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  // --- keyboard navigation ---
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        navigateToSearch(suggestions[activeIndex].data);
      } else {
        navigateToSearch(query);
      }
      setShowDropdown(false);
      return;
    }

    if (e.key === "Escape") {
      setShowDropdown(false);
      setActiveIndex(-1);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0,
      );
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1,
      );
      return;
    }
  };

  const hasSuggestions = showDropdown && suggestions.length > 0;

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
      <main className="relative z-10 flex flex-1 flex-col items-center px-4 pt-[25vh]">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-4"
        >
          <Image
            src="/logo.png"
            alt="DimSum Logo"
            width={72}
            height={72}
            priority
          />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="text-2xl md:text-3xl font-semibold text-foreground"
        >
          DimSum AI Labs
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-1.5 text-sm text-muted-foreground"
        >
          {t("subtitle")}
        </motion.p>

        {/* Search bar + dropdown wrapper */}
        <motion.div
          ref={wrapperRef}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="relative mt-8 w-full max-w-[580px]"
        >
          {/* Search bar */}
          <div
            className={cn(
              "flex items-center h-12 w-full border bg-background transition-shadow",
              hasSuggestions
                ? "rounded-t-full rounded-b-none border-b-0 shadow-md"
                : "rounded-full shadow-sm hover:shadow-md",
              isFocused && !hasSuggestions && "shadow-md",
            )}
          >
            {/* Search icon */}
            <div className="flex items-center pl-4 pr-2">
              <Search className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Input */}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                setIsFocused(true);
                if (suggestions.length > 0 && query.trim()) {
                  setShowDropdown(true);
                }
              }}
              onBlur={() => setIsFocused(false)}
              placeholder={t("searchPlaceholder")}
              className="flex-1 h-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />

            {/* Search button */}
            <Button
              size="sm"
              onClick={() => {
                navigateToSearch(query);
                setShowDropdown(false);
              }}
              className="mr-1.5 h-8 rounded-full px-4 text-sm"
            >
              {t("searchButton")}
            </Button>
          </div>

          {/* Dropdown suggestions */}
          <AnimatePresence>
            {hasSuggestions && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 right-0 top-full z-50 overflow-hidden rounded-b-2xl border border-t-0 bg-background shadow-md"
              >
                {/* Divider line */}
                <div className="mx-4 border-t" />

                <ul className="py-1">
                  {suggestions.map((item, idx) => (
                    <li
                      key={item.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        navigateToSearch(item.data);
                        setShowDropdown(false);
                      }}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                        activeIndex === idx
                          ? "bg-accent"
                          : "hover:bg-accent/50",
                      )}
                    >
                      <Search className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate text-foreground">
                        {item.data}
                      </span>
                      <span className="flex-shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {item.category}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

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
          {HOT_TERMS.map((term) => (
            <button
              key={term}
              onClick={() => navigateToSearch(term)}
              className="rounded-full border px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
            >
              {term}
            </button>
          ))}
        </motion.div>

        {/* Data stats link */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="mt-4"
        >
          <a
            href="https://www.aidimsum.com/zh#stats"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>{t("viewDataStats")}</span>
            <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
          </a>
        </motion.div>
      </main>

      {/* Footer */}
      <div className="relative z-10">
        <MinimalFooter />
      </div>
    </div>
  );
}
