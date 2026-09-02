"use client";

import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { Menu, Settings, LogOut, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { HamburgerMenuContent } from "@/components/layout/hamburger-menu-content";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSession } from "next-auth/react";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { getAccountSubmenuItems, workplaceSubmenuItems } from "./sidebar/menu-config";
import { Role } from "@prisma/client";
import { cn } from "@/lib/utils";

const allNavLinks = [
  { labelKey: "home", href: "/" },
  { labelKey: "library", href: "/library" },
  { labelKey: "appStore", href: "/appStore" },
  { labelKey: "docs", href: "/docs" },
];

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

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { user, isAuthenticated, clearUser } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = useTranslations("Nav");
  const tCommon = useTranslations("Common");

  const accountSubmenuItems = getAccountSubmenuItems(user?.role as Role);

  const handleLogout = async () => {
    await signOut({ redirect: false });
    clearUser();
    router.push("/");
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  /* ── Shared user menu (used in both desktop and mobile) ─────────── */
  const userMenu = isAuthenticated ? (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Avatar className="h-6 w-6">
            <AvatarImage src={user?.avatar || ""} alt={user?.name || ""} />
            <AvatarFallback className="text-xs">
              {user?.name?.[0] || "U"}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline text-sm">
            {user?.name || "User"}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
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
  ) : null;

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        {/* ── Desktop & Tablet Layout — Single Row ──────────────────── */}
        <div className="hidden sm:flex items-center justify-between h-14 container mx-auto px-4">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="DimSum AI Labs Logo"
                width={28}
                height={28}
                className="w-7 h-7"
              />
              <span className="font-semibold text-foreground">DimSum AI</span>
            </Link>

            {/* Desktop nav links */}
            <nav className="hidden md:flex items-center gap-1">
              {allNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                    isActive(link.href)
                      ? "text-foreground bg-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                  )}
                >
                  {t(link.labelKey)}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right: Locale + Theme + User + Hamburger (tablet only) */}
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <ThemeToggle />
            {userMenu}

            {/* Tablet hamburger (below md, nav links hidden) */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-9 w-9"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64 p-0">
                <MobileSheetContent onClose={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* ── Mobile Layout — Two Rows (matches SearchHeader) ──────── */}
        <div className="sm:hidden">
          {/* Row 1: Hamburger | Logo (centered) | User */}
          <div className="grid grid-cols-3 items-center h-14 px-4">
            {/* Left: Hamburger */}
            <div className="flex justify-start">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10">
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
                  width={28}
                  height={28}
                  className="rounded-sm"
                />
                <span className="text-base font-semibold">DimSum</span>
              </Link>
            </div>

            {/* Right: User */}
            <div className="flex justify-end">{userMenu}</div>
          </div>
        </div>
      </header>
    </>
  );
}
