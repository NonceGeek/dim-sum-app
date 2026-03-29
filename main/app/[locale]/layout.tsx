import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { ConditionalLayout } from '@/components/layout/conditional-layout';
import { Providers } from '../providers';
import { Toaster } from '@/components/ui/sonner';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <NextIntlClientProvider>
      <Providers>
        <ConditionalLayout>{children}</ConditionalLayout>
        <Toaster />
      </Providers>
    </NextIntlClientProvider>
  );
}
