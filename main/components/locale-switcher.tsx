'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale() {
    const newLocale = locale === 'zh-CN' ? 'en' : 'zh-CN';
    router.replace(pathname, { locale: newLocale });
  }

  return (
    <Button variant="ghost" size="icon" onClick={switchLocale} title="Switch language">
      <Globe className="h-4 w-4" />
      <span className="sr-only">{locale === 'zh-CN' ? 'English' : '中文'}</span>
    </Button>
  );
}
