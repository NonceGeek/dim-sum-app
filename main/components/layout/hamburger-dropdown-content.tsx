"use client";

import { Link } from "@/i18n/navigation";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ThemeToggle } from "@/components/theme-toggle/theme-toggle";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { routing } from "@/i18n/routing";

const localeLabels: Record<string, string> = {
  en: "English",
  "zh-CN": "简体中文",
};

const navLinks = [
  { labelKey: "library", href: "/library" },
  { labelKey: "appStore", href: "/appStore" },
  { labelKey: "docs", href: "/docs" },
] as const;

export function HamburgerDropdownContent() {
  const t = useTranslations("Nav");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function switchLocale(newLocale: string) {
    const search = searchParams.toString();
    const fullPath = search ? `${pathname}?${search}` : pathname;
    router.replace(fullPath, { locale: newLocale });
  }

  return (
    <>
      {navLinks.map((link) => (
        <DropdownMenuItem key={link.href} asChild>
          <Link href={link.href}>
            {t(link.labelKey)}
          </Link>
        </DropdownMenuItem>
      ))}

      <DropdownMenuSeparator />

      <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
        {tCommon("language")}
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup value={locale} onValueChange={switchLocale}>
        {routing.locales.map((l) => (
          <DropdownMenuRadioItem key={l} value={l}>
            {localeLabels[l] || l}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>

      <DropdownMenuSeparator />

      <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
        <div className="flex items-center justify-between cursor-default">
          <span className="text-sm">{tCommon("theme")}</span>
          <ThemeToggle />
        </div>
      </DropdownMenuItem>
    </>
  );
}
