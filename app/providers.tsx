'use client';

import { ThemeProvider } from 'next-themes';
import { QueryProvider } from '@/providers/query-provider';
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </QueryProvider>
  );
} 