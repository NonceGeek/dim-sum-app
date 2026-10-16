"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Search,
  Clock,
  X,
  SlidersHorizontal,
  ChevronDown,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "@/i18n/navigation";
import Image from "next/image";
import { FloatingNav } from "@/components/layout/floating-nav";
import { MinimalFooter } from "./_components/minimal-footer";
import { Dice3D } from "./_components/dice-3d";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import BorderGlow from "@/components/ui/border-glow";
import SplitText from "@/components/ui/split-text";
import TextType from "@/components/ui/text-type";
import { useSearchDropdown } from "@/lib/hooks/useSearchDropdown";
import { getCategoryNickname, useAllCategories } from "@/lib/api/category";
import { useHotTerms } from "@/lib/api/public";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useLoginGate } from "@/components/assistant/login-gate";
import { AiSparkle } from "@/components/assistant/ai-visuals";
import { useAiPalette } from "@/lib/assistant/ai-palette";
import GradientText from "@/components/ui/gradient-text";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";


type InputMode = "search" | "assistant";
const INPUT_MODE_STORAGE_KEY = "home-input-mode";

export default function HomePage() {
  const router = useRouter();
  const t = useTranslations("Home");
  const tc = useTranslations("Common");
  const tSearch = useTranslations("Search");

  const [query, setQuery] = useState("");
  const [selectedDataset, setSelectedDataset] = useState<string[]>(["all"]);
  const [datasetInputValue, setDatasetInputValue] = useState("");
  const [luckyHovered, setLuckyHovered] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  // 搜索 / 问小助手 两种模式，记住用户上次的选择
  const [inputMode, setInputMode] = useState<InputMode>("search");
  const { isAuthenticated } = useAuthStore();
  const { openLogin, dialogs: loginDialogs } = useLoginGate();
  const isAssistantMode = inputMode === "assistant";
  const aiPalette = useAiPalette();

  useEffect(() => {
    try {
      if (window.localStorage.getItem(INPUT_MODE_STORAGE_KEY) === "assistant") setInputMode("assistant");
    } catch {
      // 浏览器存储不可用时默认搜索模式
    }
  }, []);
  // 经典搜索入口暂时隐藏；保留常量便于以后恢复切换按钮。
  const useLegacySearch = false;
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
      if (!useLegacySearch) params.set("mode", "entry");
      router.push(`/search?${params.toString()}`);
    },
    [router, selectedDataset, useLegacySearch],
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
    abortSuggestions,
    selectItem,
    addToHistory,
    removeHistory,
    clearHistory,
  } = useSearchDropdown({
    query,
    selectedDataset,
    onSearchTerm: navigateToSearch,
  });

  const {
    data: hotTerms,
    refetch: refetchHotTerms,
    isFetching: hotTermsFetching,
    isLoading: hotTermsLoading,
  } = useHotTerms();

  // Mobile: mouseenter fires on tap but mouseleave never fires after touch ends,
  // so reset luckyHovered when fetching completes to ensure the dice disappears.
  useEffect(() => {
    if (!hotTermsFetching) setLuckyHovered(false);
  }, [hotTermsFetching]);

  // 带着输入内容打开小助手新对话；未登录时先登录，登录后带着问题回到小助手
  const askAssistant = () => {
    const term = query.trim();
    const target = term ? `/assistant?q=${encodeURIComponent(term)}` : "/assistant";
    abortSuggestions();
    closeDropdown();
    if (!isAuthenticated) {
      openLogin(target);
      return;
    }
    router.push(target);
  };

  const switchMode = (mode: InputMode) => {
    setInputMode(mode);
    try {
      window.localStorage.setItem(INPUT_MODE_STORAGE_KEY, mode);
    } catch {
      // 忽略存储失败
    }
    closeDropdown();
    inputRef.current?.focus();
    // 未登录切到问小助手：先弹窗询问是否登录，同意后走登录流程，登录后回到首页（模式已记住）
    if (mode === "assistant" && !isAuthenticated) {
      openLogin("/");
    }
  };

  const handleManualSearch = () => {
    if (!query.trim()) return;
    addToHistory(query.trim());
    abortSuggestions(); // 立即中止 autocomplete 请求，释放连接，让导航请求优先
    navigateToSearch(query);
    closeDropdown();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isAssistantMode) {
      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
        e.preventDefault();
        askAssistant();
      }
      return;
    }
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

  const hasDropdown =
    showDropdown &&
    (mode === "history" ? history.length > 0 : suggestions.length > 0);

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Background gradient */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, oklch(0.95 0.04 256 / 0.14), transparent 70%)",
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
          className={cn(
            "relative mt-6 w-full max-w-[720px]",
            "transition-transform duration-200 origin-top",
            searchFocused && "max-sm:scale-[1.06]"
          )}
        >
          {/* Search card with border glow — dropdown is inside the same card */}
          <BorderGlow
            borderRadius={16}
            glowRadius={30}
            glowIntensity={0.8}
            edgeSensitivity={25}
            coneSpread={30}
            fillOpacity={0.3}
            // 问小助手模式切换为与小助手页一致的 AI 配色
            glowColor={isAssistantMode ? aiPalette.glowHsl : "210 80 70"}
            backgroundColor="var(--background)"
            colors={isAssistantMode ? [...aiPalette.colors] : ["#3193ff", "#007fff", "#5aa8ff"]}
            className="w-full"
          >
            <div className="px-2.5 py-2">
              {/* Input row */}
              <div className="flex items-center h-11">
                {isAssistantMode ? (
                  <AiSparkle className="mr-2.5 h-4 w-4 flex-shrink-0" />
                ) : (
                  <Search className="h-4 w-4 text-muted-foreground mr-2.5 flex-shrink-0" />
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => {
                    // 问小助手模式不弹出搜索联想
                    if (!isAssistantMode) handleFocus();
                    setSearchFocused(true);
                  }}
                  onBlur={() => setSearchFocused(false)}
                  placeholder={isAssistantMode ? t("assistantPlaceholder") : t("searchPlaceholder")}
                  className="flex-1 h-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
                />
              </div>

              {/* Button row */}
              <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5">
                {/* 经典搜索切换按钮暂时隐藏，默认使用新版 entry 搜索。 */}
                {/* 搜索 / 问小助手 分段切换，选中块滑动过渡 */}
                {/* 切换比右侧主按钮矮一档（约 30px 对 36px），突出“搜索 / 提问”是主操作 */}
                <div className="flex items-center rounded-lg bg-muted/50 p-0.5" role="tablist">
                  {(["search", "assistant"] as const).map((mode) => {
                    const selected = inputMode === mode;
                    const isAssistant = mode === "assistant";
                    return (
                      <button
                        key={mode}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => switchMode(mode)}
                        className={cn(
                          "relative flex h-[26px] items-center gap-1 rounded-md px-2.5 text-[13px] transition-colors",
                          selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {selected && (
                          <motion.span
                            layoutId="home-input-mode"
                            className="absolute inset-0 rounded-md bg-background shadow-xs"
                            transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                          />
                        )}
                        {isAssistant ? (
                          // 选中时星星弹出并转半圈
                          <motion.span
                            key={selected ? "on" : "off"}
                            className="relative inline-flex"
                            initial={selected ? { scale: 0.4, rotate: -120 } : false}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
                          >
                            <AiSparkle className="h-3 w-3" />
                          </motion.span>
                        ) : (
                          <Search className="relative h-3 w-3" />
                        )}
                        <span
                          className={cn("relative", isAssistant && selected && "bg-clip-text text-transparent")}
                          style={isAssistant && selected ? { backgroundImage: aiPalette.linear } : undefined}
                        >
                          {isAssistant ? t("askAssistant") : t("modeSearch")}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-end gap-2 ml-auto">
                  {/* Dataset selector */}
                  {/* 数据集筛选只对搜索有效 */}
                  {!isAssistantMode && (
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
                                  animate={{
                                    scale: isGlobal ? 1 : 0.5,
                                    opacity: isGlobal ? 1 : 0,
                                  }}
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
                                        scale: selectedDataset.includes(cat.name)
                                          ? 1
                                          : 0.5,
                                        opacity: selectedDataset.includes(
                                          cat.name,
                                        )
                                          ? 1
                                          : 0,
                                      }}
                                      transition={{ duration: 0.15 }}
                                      className="h-4 w-4 flex items-center justify-center shrink-0"
                                    >
                                      <Check className="h-3.5 w-3.5 text-primary" />
                                    </motion.div>
                                    <span className="truncate">
                                      {cat.nickname ?? cat.name}
                                    </span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </motion.div>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  )}

                  <Button
                    onClick={isAssistantMode ? askAssistant : handleManualSearch}
                    className={cn(
                      "h-9 px-6 rounded-lg text-sm font-medium",
                      isAssistantMode && "text-white shadow-md hover:opacity-90",
                    )}
                    style={isAssistantMode ? { backgroundImage: aiPalette.linear } : undefined}
                  >
                    {isAssistantMode ? t("assistantSubmit") : t("searchButton")}
                  </Button>
                </div>
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
                        <span className="text-xs font-medium text-muted-foreground">
                          {tSearch("recentSearches")}
                        </span>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            clearHistory();
                          }}
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
                              activeIndex === idx
                                ? "bg-accent"
                                : "hover:bg-accent/50",
                            )}
                          >
                            <button
                              className="flex flex-1 min-w-0 items-center gap-3 text-left"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                selectItem(term);
                              }}
                            >
                              <Clock className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                              <span className="flex-1 truncate text-foreground">
                                {term}
                              </span>
                            </button>
                            <button
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity shrink-0"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                removeHistory(term);
                              }}
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
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectItem(item.data);
                          }}
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
                            {getCategoryNickname(categories ?? [], item.category)}
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
            // Widths designed to naturally fill ~2 rows in a 720px container
            [200, 120, 280, 160, 220, 140].map((w, i) => (
              <div
                key={i}
                className="skeleton-shimmer h-7 rounded-full"
                style={{ width: w }}
              />
            ))
          ) : (
            <>
              {(hotTerms ?? []).map((term, i) => (
                <motion.button
                  key={term}
                  title={term}
                  onClick={() => navigateToSearch(term)}
                  className="max-w-[14rem] truncate rounded-full border px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04, ease: "easeOut" }}
                >
                  {term}
                </motion.button>
              ))}
              <motion.div
                className="relative"
                onMouseEnter={() => setLuckyHovered(true)}
                onMouseLeave={() => setLuckyHovered(false)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: (hotTerms?.length ?? 0) * 0.04, ease: "easeOut" }}
              >
                <button
                  onClick={() => refetchHotTerms()}
                  disabled={hotTermsFetching}
                  className="rounded-full px-3 py-1 text-sm transition-all disabled:opacity-40"
                  style={{
                    border: "1px solid transparent",
                    backgroundImage: `linear-gradient(var(--background), var(--background)), linear-gradient(to right, #3193ff4d, #a855f74d, #ec48994d)`,
                    backgroundOrigin: "padding-box, border-box",
                    backgroundClip: "padding-box, border-box",
                  }}
                >
                  <GradientText
                    colors={["#3193ff", "#a855f7", "#ec4899"]}
                    animationSpeed={3.5}
                    className="text-xs font-medium"
                  >
                    {t("luckyButton")}
                  </GradientText>
                </button>
                <AnimatePresence>
                  {(luckyHovered || hotTermsFetching) && (
                    <motion.div
                      className="absolute left-full top-1/2 -translate-y-1/2 ml-2.5"
                      initial={{ opacity: 0, scale: 0.4 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.4 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      <Dice3D rolling={hotTermsFetching} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </>
          )}
        </motion.div>
      </main>

      {/* Footer */}
      <div className="relative z-10">
        <MinimalFooter />
      </div>
      {loginDialogs}
    </div>
  );
}
