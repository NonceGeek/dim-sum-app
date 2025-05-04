'use client';

import { ThemeToggle } from '@/components/theme-toggle/theme-toggle';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import {
  Sidebar,
  SidebarContent as SidebarContentBase,
  SidebarGroup,
  SidebarGroupContent,
  // SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { Bell, LibraryBig, ChevronLeft, ChevronRight, Compass, Home, User, AppWindow, FileCode2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useSidebarStore } from '@/stores/use-sidebar-store';

const menuItems = [
  { icon: Home, label: 'Home', href: '/' },
  { icon: LibraryBig, label: 'Library', href: '/library' },
  { icon: AppWindow, label: 'App Store', href: '/appStore' },
  { icon: Compass, label: 'Discover', href: '/discover' },
  { icon: FileCode2, label: 'Docs', href: '/docs' },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { open, setOpen } = useSidebar();
  const { isOpen, setOpen: setSheetOpen, isMobile, setMobile } = useSidebarStore();

  useEffect(() => {
    const checkMobile = () => {
      setMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [setMobile]);

  const SidebarContent = () => (
    <>
      <div className="flex h-14 items-center border-b px-4">
        {open ? (
          <>
            <div className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="DimSum AI Labs Logo"
                width={24}
                height={24}
                className="rounded-sm"
              />
              <span className="font-semibold">DimSum AI Labs</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="ml-auto h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Collapse sidebar</span>
            </Button>
          </>
        ) : (
          <div className="flex w-full justify-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(true)}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Expand sidebar</span>
            </Button>
          </div>
        )}
      </div>
      <SidebarContentBase>
        <SidebarGroup>
          {/* <SidebarGroupLabel>Navigation</SidebarGroupLabel> */}
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-primary',
                        pathname === item.href
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-primary/5'
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContentBase>
      <div className="border-t p-4 space-y-4">
        {open ? (
          <>
            <Link
              href="/profile"
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-primary w-full',
                pathname === '/profile'
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-primary/5'
              )}
            >
              <User className="h-4 w-4 shrink-0" />
              <span>Profile</span>
            </Link>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon">
                <Bell className="h-4 w-4" />
                <span className="sr-only">Notifications</span>
              </Button>
              <ThemeToggle />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Link href="/profile">
              <Button variant="ghost" size="icon">
                <User className="h-4 w-4" />
                <span className="sr-only">Profile</span>
              </Button>
            </Link>
            <Button variant="ghost" size="icon">
              <Bell className="h-4 w-4" />
              <span className="sr-only">Notifications</span>
            </Button>
          </div>
        )}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex h-full flex-col">
            <div className="flex h-14 items-center border-b px-4">
              <div className="flex items-center gap-2">
                <Image
                  src="/logo.png"
                  alt="DimSum AI Labs Logo"
                  width={24}
                  height={24}
                  className="rounded-sm"
                />
                <span className="font-semibold">DimSum AI Labs</span>
              </div>
            </div>
            <div className="flex-1 overflow-auto py-2">
              <SidebarContentBase>
                <SidebarGroup>
                  {/* <SidebarGroupLabel>Navigation</SidebarGroupLabel> */}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {menuItems.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild>
                            <Link
                              href={item.href}
                              className={cn(
                                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-primary',
                                pathname === item.href
                                  ? 'bg-primary/10 text-primary'
                                  : 'hover:bg-primary/5'
                              )}
                              onClick={() => setSheetOpen(false)}
                            >
                              <item.icon className="h-4 w-4 shrink-0" />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </SidebarContentBase>
            </div>
            <div className="border-t p-4 space-y-4">
              <Link
                href="/profile"
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-primary w-full',
                  pathname === '/profile'
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-primary/5'
                )}
                onClick={() => setSheetOpen(false)}
              >
                <User className="h-4 w-4 shrink-0" />
                <span>Profile</span>
              </Link>
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon">
                  <Bell className="h-4 w-4" />
                  <span className="sr-only">Notifications</span>
                </Button>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarContent />
    </Sidebar>
  );
} 