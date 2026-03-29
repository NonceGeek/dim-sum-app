"use client";

import { Link } from "@/i18n/navigation";
import { ThemeToggle } from "@/components/theme-toggle/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useTranslations } from "next-intl";

const navLinks = [
  { labelKey: "library", href: "/library" },
  { labelKey: "appStore", href: "/appStore" },
  { labelKey: "docs", href: "/docs" },
] as const;

interface HamburgerMenuContentProps {
  onNavClick?: () => void;
}

export function HamburgerMenuContent({ onNavClick }: HamburgerMenuContentProps) {
  const t = useTranslations("Nav");
  const tCommon = useTranslations("Common");

  return (
    <>
      {navLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          onClick={onNavClick}
          className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        >
          {t(link.labelKey)}
        </Link>
      ))}

      <div className="border-t border-border my-2" />

      <div className="px-3 py-2 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-foreground">
            {tCommon("language")}
          </span>
          <LocaleSwitcher />
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-foreground">
            {tCommon("theme")}
          </span>
          <ThemeToggle />
        </div>
      </div>
    </>
  );
}
