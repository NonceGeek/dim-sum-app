import { MainLayout } from '@/components/layout/main-layout';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
      </head>
      <body>
        <Providers>
          <MainLayout>{children}</MainLayout>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
} 