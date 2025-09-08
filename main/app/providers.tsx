'use client';

import { ThemeProvider } from 'next-themes';
import { QueryProvider } from '@/providers/query-provider';
import { SessionProvider } from 'next-auth/react';
import { AuthProvider } from '@/components/providers/auth-provider';
import { WalletProvider } from '@/lib/wallet/providers';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthProvider>
        <WalletProvider>
          <QueryProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              forcedTheme="dark"
              // enableSystem
              disableTransitionOnChange
            >
              {children}
            </ThemeProvider>
          </QueryProvider>
        </WalletProvider>
      </AuthProvider>
    </SessionProvider>
  );
} 