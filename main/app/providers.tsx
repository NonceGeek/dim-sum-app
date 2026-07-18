'use client';

import { ThemeProvider } from 'next-themes';
import { QueryProvider } from '@/providers/query-provider';
import { SessionProvider } from 'next-auth/react';
import { AuthProvider } from '@/components/providers/auth-provider';
import { WalletProvider } from '@/lib/wallet/providers';
import { ClientErrorRecovery } from '@/components/client-error-recovery';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthProvider>
        <WalletProvider>
          <QueryProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <ClientErrorRecovery />
              {children}
            </ThemeProvider>
          </QueryProvider>
        </WalletProvider>
      </AuthProvider>
    </SessionProvider>
  );
} 