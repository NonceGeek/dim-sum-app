'use client';

import Link from 'next/link';
import { Search, Menu } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSidebarStore } from '@/stores/use-sidebar-store';

export function Header() {
  const setOpen = useSidebarStore((state) => state.setOpen);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-14 items-center">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
          <Link className="flex items-center space-x-2" href="/">
            <span className="font-bold">DimSum AI Labs</span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <div className="w-full max-w-sm">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-8"
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
} 