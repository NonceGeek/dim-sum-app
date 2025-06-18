'use client';

import { ThemeProvider } from 'next-themes';
import { QueryProvider } from '@/providers/query-provider';
import { SessionProvider } from 'next-auth/react';
import { AuthProvider } from '@/components/providers/auth-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthProvider>
    <QueryProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        // enableSystem
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </QueryProvider>
      </AuthProvider>
    </SessionProvider>
  );
} 