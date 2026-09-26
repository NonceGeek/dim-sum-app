'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { routing } from '@/i18n/routing';

const localeLabels: Record<string, string> = {
  'zh-CN': '简体中文',
  'en': 'English',
};

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations('Common');
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function switchLocale(newLocale: string) {
    if (newLocale === locale || !routing.locales.includes(newLocale as typeof routing.locales[number])) return;
    const search = searchParams.toString();
    // Explicit prefix lets middleware persist the preference before removing the
    // default prefix. Reload also discards redirects prefetched in the old locale.
    const target = `/${newLocale}${pathname === '/' ? '' : pathname}`;
    window.location.assign(`${target}${search ? `?${search}` : ''}${window.location.hash}`);
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Languages className="h-4 w-4" />
          <span className="sr-only">{t('language')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {routing.locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => switchLocale(l)}
            className={l === locale ? 'bg-accent' : ''}
          >
            {localeLabels[l] || l}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
