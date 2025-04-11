import { ReactNode } from 'react';
import { AppSidebar } from './sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="relative flex min-h-screen w-full flex-col">
        <div className="flex flex-1">
          <AppSidebar />
          <main className="flex-1 overflow-auto">
            <div className="container max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
} 