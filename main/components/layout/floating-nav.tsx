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
import { useRouter } from "@/i18n/navigation";
import { useSession } from "next-auth/react";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { LoginDialog } from "@/components/dialogs/login-dialog";
import { RoleSelectDialog, UserRole } from "@/components/dialogs/role-select-dialog";
import { getAccountSubmenuItems, workplaceSubmenuItems } from "./sidebar/menu-config";
import { Role } from "@prisma/client";

const navLinks = [
  { labelKey: "library", href: "/library" },
  { labelKey: "appStore", href: "/appStore" },
  { labelKey: "docs", href: "/docs" },
];

export function FloatingNav() {
  const router = useRouter();
  const { data: session } = useSession();
  const { user, isAuthenticated, clearUser } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showRoleSelect, setShowRoleSelect] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const t = useTranslations('Nav');
  const tCommon = useTranslations('Common');

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

  return (
    <>
      <nav className="fixed top-4 right-6 z-50 flex items-center gap-4">
        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t(link.labelKey)}
            </Link>
          ))}
        </div>

        {/* Locale + Theme toggle — hidden on mobile, shown in hamburger drawer */}
        <span className="hidden md:contents">
          <LocaleSwitcher />
          <ThemeToggle />
        </span>

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
                <DropdownMenuItem key={item.href} onSelect={() => router.push(item.href)}>
                  <item.icon className="mr-2 h-4 w-4" />
                  {t(item.labelKey)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {workplaceSubmenuItems.map((item) => (
                <DropdownMenuItem key={item.href} onSelect={() => router.push(item.href)}>
                  <item.icon className="mr-2 h-4 w-4" />
                  {t(item.labelKey)}
                </DropdownMenuItem>
              ))}
              {session?.user?.isSystemAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => window.open('/admin', '_blank')}>
                    <Settings className="mr-2 h-4 w-4" />
                    {t('admin')}
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                {tCommon('signOut')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowRoleSelect(true)}
          >
            {tCommon('signIn')}
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
                <HamburgerMenuContent onNavClick={() => setMobileOpen(false)} />
              </nav>
            </div>
          </SheetContent>
        </Sheet>
      </nav>

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
