"use client";

import { cn } from "@/lib/utils";
import { type SearchResult } from "@/lib/api/search";
import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CategoryTabsProps {
  results: SearchResult[];
  selectedCategory: string;
  onSelect: (category: string) => void;
  selectedDataset: string[];
}

interface ScrollableTabListProps {
  tabs: Array<{ label: string; value: string; count: number }>;
  selectedCategory: string;
  onSelect: (category: string) => void;
  withSpacer?: boolean;
}

function ScrollableTabList({
  tabs,
  selectedCategory,
  onSelect,
  withSpacer = false,
}: ScrollableTabListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  // Check if scrolling is needed and update arrow visibility
  const updateArrowsVisibility = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    const hasOverflow = scrollWidth > clientWidth;

    setShowLeftArrow(hasOverflow && scrollLeft > 5);
    setShowRightArrow(
      hasOverflow && scrollLeft < scrollWidth - clientWidth - 5,
    );
  }, []);

  // Scroll handler
  const scroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 300;
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  // Auto-scroll to selected tab
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const selectedButton = container.querySelector(
      `[data-value="${selectedCategory}"]`,
    ) as HTMLButtonElement;

    if (selectedButton) {
      const containerRect = container.getBoundingClientRect();
      const buttonRect = selectedButton.getBoundingClientRect();
      const scrollLeft = container.scrollLeft;

      // Calculate if button is outside visible area
      const isLeftOutside = buttonRect.left < containerRect.left;
      const isRightOutside = buttonRect.right > containerRect.right;

      if (isLeftOutside || isRightOutside) {
        // Scroll to center the selected tab
        const offset =
          buttonRect.left -
          containerRect.left +
          scrollLeft -
          containerRect.width / 2 +
          buttonRect.width / 2;
        container.scrollTo({
          left: offset,
          behavior: "smooth",
        });
      }
    }
  }, [selectedCategory]);

  // Initialize and update arrows on mount and scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Use ResizeObserver to detect when content is fully loaded
    const resizeObserver = new ResizeObserver(() => {
      updateArrowsVisibility();
    });

    resizeObserver.observe(container);

    // Initial check
    updateArrowsVisibility();

    // Also check after a short delay to ensure styles are applied
    const timeoutId = setTimeout(updateArrowsVisibility, 100);

    container.addEventListener("scroll", updateArrowsVisibility);
    window.addEventListener("resize", updateArrowsVisibility);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      container.removeEventListener("scroll", updateArrowsVisibility);
      window.removeEventListener("resize", updateArrowsVisibility);
    };
  }, [updateArrowsVisibility]);

  return (
    <div className="flex">
      {withSpacer && (
        <div className="flex items-center gap-2 shrink-0 w-[172px]">
          {/* Spacer to match logo width */}
        </div>
      )}

      <div className="relative flex-1 min-w-0">
        {/* Left arrow button */}
        {showLeftArrow && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-0 bottom-0 z-10 flex items-center justify-center w-10 bg-gradient-to-r from-background via-background/90 to-transparent hover:via-background transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
          </button>
        )}

        {/* Right arrow button */}
        {showRightArrow && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-0 bottom-0 z-10 flex items-center justify-center w-10 bg-gradient-to-l from-background via-background/90 to-transparent hover:via-background transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
          </button>
        )}

        {/* Left gradient fade */}
        {showLeftArrow && (
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent pointer-events-none z-[5]" />
        )}

        {/* Right gradient fade */}
        {showRightArrow && (
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none z-[5]" />
        )}

        {/* Scrollable tabs container */}
        <div
          ref={scrollContainerRef}
          className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-smooth"
        >
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                data-value={tab.value}
                onClick={() => onSelect(tab.value)}
                className={cn(
                  "shrink-0 px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors duration-150",
                  selectedCategory === tab.value
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                <span className="ml-1 text-xs opacity-60">({tab.count})</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CategoryTabs({
  results,
  selectedCategory,
  onSelect,
  selectedDataset,
}: CategoryTabsProps) {
  const t = useTranslations("Search");

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
    { label: t("allCategories"), value: "全部", count: results.length },
    ...categories.map(([cat, count]) => ({ label: cat, value: cat, count })),
  ];

  return (
    <div className="bg-background">
      <div className="px-4 border-b border-border">
        {/* Desktop/Tablet: Align with search bar (logo + gap ≈ 172px) */}
        <div className="hidden sm:block">
          <ScrollableTabList
            tabs={tabs}
            selectedCategory={selectedCategory}
            onSelect={onSelect}
            withSpacer
          />
        </div>

        {/* Mobile: No left spacing */}
        <div className="sm:hidden">
          <ScrollableTabList
            tabs={tabs}
            selectedCategory={selectedCategory}
            onSelect={onSelect}
            withSpacer={false}
          />
        </div>
      </div>
    </div>
  );
}
