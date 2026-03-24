"use client";

import { useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useTranslations } from "next-intl";
import { LoginDialog } from "@/components/dialogs/login-dialog";
import { RoleSelectDialog, UserRole } from "@/components/dialogs/role-select-dialog";
import { getAccountSubmenuItems, workplaceSubmenuItems } from "@/components/layout/sidebar/menu-config";
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
  isPending: boolean;
  selectedDataset: string[];
  onDatasetChange: (dataset: string[]) => void;
  categories: Category[];
  searchPlaceholder: string;
  searchButtonLabel: string;
  searchingLabel: string;
}

const navLinks = [
  { labelKey: "library", href: "/library" },
  { labelKey: "appStore", href: "/appStore" },
  { labelKey: "docs", href: "/docs" },
];

const mobileNavLinks = [
  { labelKey: "home", href: "/" },
  { labelKey: "library", href: "/library" },
  { labelKey: "appStore", href: "/appStore" },
  { labelKey: "docs", href: "/docs" },
];

export function SearchHeader({
  searchPrompt,
  onSearchPromptChange,
  onSearch,
  isPending,
  selectedDataset,
  onDatasetChange,
  categories,
  searchPlaceholder,
  searchButtonLabel,
  searchingLabel,
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
      selectedDataset.includes(cat.name) ? cat.nickname ?? cat.name : null
    )
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="px-4 h-14 flex items-center gap-3">
          {/* Logo */}
          <Link href="/" className="shrink-0">
            <Image
              src="/logo.png"
              alt="DimSum AI Labs"
              width={28}
              height={28}
              className="rounded-sm"
            />
          </Link>

          {/* Search input — dataset selector embedded on right */}
          <div className="relative flex-1 flex items-center rounded-md border border-input bg-background shadow-sm transition-all hover:ring-1 hover:ring-primary/40 focus-within:ring-1 focus-within:ring-primary/50 dark:bg-background">
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
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearch();
              }}
              className="flex-1 min-w-0 h-9 px-2 bg-transparent text-sm outline-none placeholder:text-muted-foreground dark:text-accent-foreground dark:placeholder:text-accent-foreground"
            />

            {/* Divider + dataset selector + clear button */}
            <div className="flex items-center shrink-0 pr-1">
              <div className="w-px h-4 bg-border mx-1" />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2 relative"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline truncate max-w-[80px]">
                      {datasetLabel || tSearch("selectDataset")}
                    </span>
                    <ChevronDown className="h-3 w-3 shrink-0" />
                    {activeDatasetCount > 0 && (
                      <Badge className="sm:hidden absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center">
                        {activeDatasetCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                  <Command className="bg-background!">
                    <CommandInput
                      placeholder={tSearch("searchDatasetPlaceholder")}
                      value={inputValue}
                      onValueChange={setInputValue}
                    />
                    <CommandList>
                      {categories.map((cat) => (
                        <CommandItem
                          key={cat.id}
                          value={cat.nickname ?? cat.name}
                          onSelect={() => toggleDataset(cat.name)}
                        >
                          <Checkbox
                            className="mr-2 dark:bg-accent-background"
                            checked={selectedDataset.includes(cat.name)}
                            onChange={() => toggleDataset(cat.name)}
                            id={`dataset-${cat.id}`}
                          />
                          {cat.nickname ?? cat.name}
                        </CommandItem>
                      ))}
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
            </div>
          </div>

          {/* Search button */}
          <Button
            onClick={onSearch}
            disabled={isPending}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
          >
            {isPending ? searchingLabel : searchButtonLabel}
          </Button>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {t(link.labelKey)}
              </Link>
            ))}
          </div>

          {/* Locale + Theme toggle */}
          <LocaleSwitcher />
          <ThemeToggle />

          {/* User menu / Sign In */}
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={user?.avatar || ""} alt={user?.name || ""} />
                    <AvatarFallback className="text-xs">
                      {user?.name?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm">{user?.name || "User"}</span>
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
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowRoleSelect(true)}
            >
              {tCommon("signIn")}
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
                  {mobileNavLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                    >
                      {t(link.labelKey)}
                    </Link>
                  ))}
                  {session?.user?.isSystemAdmin && (
                    <Link
                      href="/admin"
                      target="_blank"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      {t("admin")}
                    </Link>
                  )}
                </nav>
              </div>
            </SheetContent>
          </Sheet>
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
