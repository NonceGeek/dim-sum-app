"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import {
  Search,
  X,
  SlidersHorizontal,
  Menu,
  ChevronDown,
  Settings,
  LogOut,
  Loader2,
  Check,
  Clock,
} from "lucide-react";
import { useSearchDropdown } from "@/lib/hooks/useSearchDropdown";
import type { SearchResult } from "@/lib/api/search";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { motion, AnimatePresence } from "motion/react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { HamburgerMenuContent } from "@/components/layout/hamburger-menu-content";
import { HamburgerDropdownContent } from "@/components/layout/hamburger-dropdown-content";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { LoginDialog } from "@/components/dialogs/login-dialog";
import {
  RoleSelectDialog,
  UserRole,
} from "@/components/dialogs/role-select-dialog";
import {
  getAccountSubmenuItems,
  workplaceSubmenuItems,
} from "@/components/layout/sidebar/menu-config";
import { Role } from "@prisma/client";

interface Category {
  id: string | number;
  name: string;
  nickname?: string;
}

interface SearchHeaderProps {
  searchPrompt: string;
  onSearchPromptChange: (value: string) => void;
  onSearch: () => void;
  /** Called when user selects from suggestion/history dropdown — must update prompt AND trigger search */
  onSearchTerm: (term: string) => void;
  isPending: boolean;
  selectedDataset: string[];
  onDatasetChange: (dataset: string[]) => void;
  categories: Category[];
  searchPlaceholder: string;
  searchButtonLabel: string;
  searchingLabel: string;
  shadowActive?: boolean;
}

interface DropdownState {
  showDropdown: boolean;
  mode: "history" | "suggestions";
  suggestions: SearchResult[];
  history: string[];
  activeIndex: number;
  handleFocus: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  closeDropdown: () => void;
  selectItem: (term: string) => void;
  addToHistory: (term: string) => void;
  removeHistory: (term: string) => void;
  clearHistory: () => void;
}

interface SearchInputProps {
  searchPrompt: string;
  onSearchPromptChange: (value: string) => void;
  onSearch: () => void;
  isPending: boolean;
  selectedDataset: string[];
  onDatasetChange: (dataset: string[]) => void;
  categories: Category[];
  searchPlaceholder: string;
  searchButtonLabel: string;
  searchingLabel: string;
  inputValue: string;
  setInputValue: (value: string) => void;
  datasetLabel: string;
  activeDatasetCount: number;
  toggleDataset: (name: string) => void;
  tSearch: (key: string) => string;
  dropdownState: DropdownState;
}

function SearchInputField({
  searchPrompt,
  onSearchPromptChange,
  onSearch,
  isPending,
  selectedDataset,
  categories,
  searchPlaceholder,
  searchButtonLabel,
  inputValue,
  setInputValue,
  datasetLabel,
  activeDatasetCount,
  toggleDataset,
  tSearch,
  dropdownState,
}: SearchInputProps) {
  const isGlobal = selectedDataset.includes("all");
  const allCategory = categories.find((cat) => cat.name === "all");
  const specificCategories = categories.filter((cat) => cat.name !== "all");

  const {
    showDropdown,
    mode,
    suggestions,
    history,
    activeIndex,
    handleFocus,
    handleKeyDown,
    closeDropdown,
    selectItem,
    addToHistory,
    removeHistory,
    clearHistory,
  } = dropdownState;

  const handleManualSearch = () => {
    if (searchPrompt.trim()) addToHistory(searchPrompt.trim());
    onSearch();
    closeDropdown();
  };

  return (
    <div className="relative">
      {/* Pill input bar */}
      <div className="relative flex items-center rounded-full bg-muted/50 border border-border shadow-sm transition-all hover:bg-muted focus-within:bg-muted focus-within:ring-1 focus-within:ring-ring">
        {/* Search icon */}
        <div className="pl-3 flex items-center pointer-events-none shrink-0">
          <Search className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Text input */}
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchPrompt}
          onChange={(e) => onSearchPromptChange(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (showDropdown && activeIndex >= 0) {
                handleKeyDown(e); // select from dropdown
              } else {
                handleManualSearch();
              }
              return;
            }
            handleKeyDown(e); // ↑↓ Escape
          }}
          className="flex-1 min-w-0 h-12 px-2 bg-transparent text-sm outline-none placeholder:text-muted-foreground dark:text-accent-foreground dark:placeholder:text-accent-foreground"
        />

        {/* Divider + dataset selector + clear button */}
        <div className="flex items-center shrink-0 pr-1">
          <div className="w-px h-4 bg-border mx-1" />
          <Popover>
            <Tooltip>
              <PopoverTrigger asChild>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2 relative"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:flex items-center overflow-hidden max-w-[80px]">
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={datasetLabel}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.12, ease: "easeInOut" }}
                          className="truncate"
                        >
                          {datasetLabel || tSearch("selectDataset")}
                        </motion.span>
                      </AnimatePresence>
                    </span>
                    <ChevronDown className="h-3 w-3 shrink-0" />
                    {activeDatasetCount > 0 && (
                      <Badge className="sm:hidden absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center">
                        {activeDatasetCount}
                      </Badge>
                    )}
                  </Button>
                </TooltipTrigger>
              </PopoverTrigger>
              {activeDatasetCount > 1 && (
                <TooltipContent side="bottom" className="flex flex-col gap-0.5">
                  {categories
                    .filter((cat) => selectedDataset.includes(cat.name))
                    .map((cat) => (
                      <span key={cat.name}>{cat.nickname ?? cat.name}</span>
                    ))}
                </TooltipContent>
              )}
            </Tooltip>
            <PopoverContent className="w-[220px] p-0">
              <Command className="bg-background!">
                <CommandInput
                  placeholder={tSearch("searchDatasetPlaceholder")}
                  value={inputValue}
                  onValueChange={setInputValue}
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
                          transition={{ duration: 0.15, ease: "easeOut" }}
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
                              transition={{ duration: 0.15, ease: "easeOut" }}
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

          {searchPrompt && (
            <button
              type="button"
              onClick={() => onSearchPromptChange("")}
              className="flex items-center justify-center h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Search button — icon-only on mobile, text on sm+ */}
          <Button
            onClick={handleManualSearch}
            disabled={isPending}
            className="relative bg-primary hover:bg-primary/90 text-primary-foreground ml-1 rounded-full shrink-0 h-9 w-9 p-0 sm:h-10 sm:w-auto sm:px-4"
          >
            <Loader2
              className={cn(
                "absolute inset-0 m-auto h-4 w-4 animate-spin transition-opacity",
                isPending ? "opacity-100" : "opacity-0"
              )}
            />
            <Search
              className={cn(
                "h-4 w-4 sm:hidden transition-opacity",
                isPending ? "opacity-0" : "opacity-100"
              )}
            />
            <span className={cn("hidden sm:inline transition-opacity", isPending ? "opacity-0" : "opacity-100")}>
              {searchButtonLabel}
            </span>
          </Button>
        </div>
      </div>

      {/* Suggestion / History Dropdown */}
      <AnimatePresence>
        {showDropdown && (mode === "history" ? history.length > 0 : suggestions.length > 0) && (
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-full left-0 right-0 mt-1.5 bg-background border border-border rounded-xl shadow-lg z-50 overflow-hidden"
          >
            {mode === "history" ? (
              <>
                <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
                  <span className="text-xs font-medium text-muted-foreground">最近搜索</span>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); clearHistory(); }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    清空
                  </button>
                </div>
                {history.map((term, idx) => (
                  <div
                    key={term}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 group",
                      activeIndex === idx ? "bg-accent" : "hover:bg-accent/50"
                    )}
                  >
                    <button
                      className="flex items-center gap-2 flex-1 min-w-0 text-left text-sm"
                      onMouseDown={(e) => { e.preventDefault(); selectItem(term); }}
                    >
                      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{term}</span>
                    </button>
                    <button
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity shrink-0"
                      onMouseDown={(e) => { e.preventDefault(); removeHistory(term); }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </>
            ) : (
              suggestions.map((result, idx) => (
                <div
                  key={`${result.id ?? idx}`}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 text-sm cursor-pointer",
                    activeIndex === idx ? "bg-accent" : "hover:bg-accent/50"
                  )}
                  onMouseDown={(e) => { e.preventDefault(); selectItem(result.data); }}
                >
                  <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{result.data}</span>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MobileSheetContent({ onClose }: { onClose: () => void }) {
  return (
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
        <HamburgerMenuContent onNavClick={onClose} />
      </nav>
    </div>
  );
}

export function SearchHeader({
  searchPrompt,
  onSearchPromptChange,
  onSearch,
  onSearchTerm,
  isPending,
  selectedDataset,
  onDatasetChange,
  categories,
  searchPlaceholder,
  searchButtonLabel,
  searchingLabel,
  shadowActive,
}: SearchHeaderProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { user, isAuthenticated, clearUser } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showRoleSelect, setShowRoleSelect] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [inputValue, setInputValue] = useState("");

  const t = useTranslations("Nav");
  const tCommon = useTranslations("Common");
  const tSearch = useTranslations("Search");

  const dropdown = useSearchDropdown({
    query: searchPrompt,
    selectedDataset,
    onSearchTerm,
  });

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

  const toggleDataset = (name: string) => {
    if (name === "all") {
      onDatasetChange(["all"]);
      return;
    }
    const next = selectedDataset.includes(name)
      ? selectedDataset.filter((item) => item !== name)
      : [...selectedDataset, name];
    const withoutAll = next.filter((item) => item !== "all");
    onDatasetChange(withoutAll.length ? withoutAll : ["all"]);
  };

  const activeDatasetCount =
    selectedDataset.length === 1 && selectedDataset[0] === "all"
      ? 0
      : selectedDataset.length;

  const datasetLabel = categories
    .map((cat) =>
      selectedDataset.includes(cat.name) ? (cat.nickname ?? cat.name) : null,
    )
    .filter(Boolean)
    .join(", ");

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 0);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const showShadow = shadowActive !== undefined ? shadowActive : scrolled;

  // Destructure wrapperRef separately; the rest is passed as dropdownState
  const { wrapperRef, ...dropdownState } = dropdown;

  return (
    <>
      <header
        ref={wrapperRef as React.RefObject<HTMLElement>}
        className={cn("sticky top-0 z-50 bg-background transition-shadow duration-200", showShadow && "shadow-sm")}
      >
        {/* Desktop & Tablet Layout - Single Row */}
        <div className="hidden sm:flex items-center gap-3 h-16 px-4">
          {/* Left: Logo - Fixed width */}
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/" className="flex items-center gap-2 h-12">
              <Image
                src="/logo.png"
                alt="DimSum AI Labs"
                width={32}
                height={32}
                className="rounded-sm"
              />
              <span className="text-3xl font-semibold">DimSum</span>
            </Link>
          </div>

          {/* Center: Search Bar - Flexible width with max limit */}
          <div className="min-w-0 max-w-3xl flex-1">
            <SearchInputField
              searchPrompt={searchPrompt}
              onSearchPromptChange={onSearchPromptChange}
              onSearch={onSearch}
              isPending={isPending}
              selectedDataset={selectedDataset}
              onDatasetChange={onDatasetChange}
              categories={categories}
              searchPlaceholder={searchPlaceholder}
              searchButtonLabel={searchButtonLabel}
              searchingLabel={searchingLabel}
              inputValue={inputValue}
              setInputValue={setInputValue}
              datasetLabel={datasetLabel}
              activeDatasetCount={activeDatasetCount}
              toggleDataset={toggleDataset}
              tSearch={tSearch}
              dropdownState={dropdownState}
            />
          </div>

          {/* Right: Hamburger + User */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">

            {/* Desktop: Dropdown hamburger (lg+) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="hidden md:flex h-8 w-8">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <HamburgerDropdownContent />
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile/tablet: Sheet hamburger (below lg) */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-8 w-8">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64 p-0">
                <MobileSheetContent onClose={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>

            {/* User menu / Sign In */}
            {isAuthenticated ? (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={user?.avatar || ""} alt={user?.name || ""} />
                      <AvatarFallback className="text-xs">
                        {user?.name?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline text-sm">
                      {user?.name || "User"}
                    </span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {accountSubmenuItems.map((item) => (
                    <DropdownMenuItem key={item.href} onClick={() => router.push(item.href)}>
                      <item.icon className="mr-2 h-4 w-4" />
                      {t(item.labelKey)}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  {workplaceSubmenuItems.map((item) => (
                    <DropdownMenuItem key={item.href} onClick={() => router.push(item.href)}>
                      <item.icon className="mr-2 h-4 w-4" />
                      {t(item.labelKey)}
                    </DropdownMenuItem>
                  ))}
                  {session?.user?.isSystemAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => window.open("/admin", "_blank")}>
                        <Settings className="mr-2 h-4 w-4" />
                        {t("admin")}
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    {tCommon("signOut")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="default" size="sm" onClick={() => setShowRoleSelect(true)}>
                {tCommon("signIn")}
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Layout - Two Rows */}
        <div className="sm:hidden">
          {/* First Row: Menu + Logo (centered) + User */}
          <div className="grid grid-cols-3 items-center h-14 px-4">
            {/* Left: Hamburger Menu */}
            <div className="flex justify-start">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-64 p-0">
                  <MobileSheetContent onClose={() => setMobileOpen(false)} />
                </SheetContent>
              </Sheet>
            </div>

            {/* Center: Logo */}
            <div className="flex justify-center">
              <Link href="/" className="flex items-center gap-2">
                <Image
                  src="/logo.png"
                  alt="DimSum AI Labs"
                  width={24}
                  height={24}
                  className="rounded-sm"
                />
                <span className="text-sm font-semibold">DimSum AI</span>
              </Link>
            </div>

            {/* Right: User */}
            <div className="flex justify-end items-center gap-2">
              {isAuthenticated ? (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Avatar className="h-6 w-6">
                        <AvatarImage
                          src={user?.avatar || ""}
                          alt={user?.name || ""}
                        />
                        <AvatarFallback className="text-xs">
                          {user?.name?.[0] || "U"}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {accountSubmenuItems.map((item) => (
                      <DropdownMenuItem
                        key={item.href}
                        onClick={() => router.push(item.href)}
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {t(item.labelKey)}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    {workplaceSubmenuItems.map((item) => (
                      <DropdownMenuItem
                        key={item.href}
                        onClick={() => router.push(item.href)}
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {t(item.labelKey)}
                      </DropdownMenuItem>
                    ))}
                    {session?.user?.isSystemAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => window.open("/admin", "_blank")}
                        >
                          <Settings className="mr-2 h-4 w-4" />
                          {t("admin")}
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      {tCommon("signOut")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowRoleSelect(true)}
                >
                  {tCommon("signIn")}
                </Button>
              )}
            </div>
          </div>

          {/* Second Row: Search Bar */}
          <div className="px-4 pb-3">
            <SearchInputField
              searchPrompt={searchPrompt}
              onSearchPromptChange={onSearchPromptChange}
              onSearch={onSearch}
              isPending={isPending}
              selectedDataset={selectedDataset}
              onDatasetChange={onDatasetChange}
              categories={categories}
              searchPlaceholder={searchPlaceholder}
              searchButtonLabel={searchButtonLabel}
              searchingLabel={searchingLabel}
              inputValue={inputValue}
              setInputValue={setInputValue}
              datasetLabel={datasetLabel}
              activeDatasetCount={activeDatasetCount}
              toggleDataset={toggleDataset}
              tSearch={tSearch}
              dropdownState={dropdownState}
            />
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
