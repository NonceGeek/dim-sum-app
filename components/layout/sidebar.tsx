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
import { Bell, LibraryBig, ChevronLeft, ChevronRight, Compass, Home, User, AppWindow, FileCode2, LogOut } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSidebarStore } from '@/stores/use-sidebar-store';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { signOut } from 'next-auth/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const menuItems = [
  { icon: Home, label: 'Home', href: '/' },
  { icon: LibraryBig, label: 'Library', href: '/library' },
  { icon: AppWindow, label: 'App Store', href: '/appStore' },
  { icon: Compass, label: 'Discover', href: '/discover' },
  { icon: FileCode2, label: 'Docs', href: '/docs' },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { open, setOpen } = useSidebar();
  const { isOpen, setOpen: setSheetOpen, isMobile, setMobile } = useSidebarStore();
  const { user, isAuthenticated, clearUser } = useAuthStore();

  useEffect(() => {
    const checkMobile = () => {
      setMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [setMobile]);

  const handleLogout = async () => {
    await signOut({ redirect: false });
    clearUser();
    router.push('/auth/signin');
  };

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
        {isAuthenticated ? (
          <>
            {open ? (
              <>
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="icon">
                    <Bell className="h-4 w-4" />
                    <span className="sr-only">Notifications</span>
                  </Button>
                  <ThemeToggle />
                </div>
                <Link
                  href="/profile"
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-primary w-full',
                    pathname === '/profile'
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-primary/5'
                  )}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={user?.avatar || ''} alt={user?.name || ''} />
                    <AvatarFallback>{user?.name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <span>{user?.name || 'User'}</span>
                </Link>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign Out</span>
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="flex flex-col items-center gap-2">
                  <Button variant="ghost" size="icon">
                    <Bell className="h-4 w-4" />
                    <span className="sr-only">Notifications</span>
                  </Button>
                  <ThemeToggle />
                </div>
                <Link href="/profile">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.avatar || ''} alt={user?.name || ''} />
                    <AvatarFallback>{user?.name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                </Link>
                <Button variant="ghost" size="icon" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  <span className="sr-only">Sign Out</span>
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            {open ? (
              <>
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="icon">
                    <Bell className="h-4 w-4" />
                    <span className="sr-only">Notifications</span>
                  </Button>
                  <ThemeToggle />
                </div>
                <Button
                  variant="default"
                  className="w-full"
                  onClick={() => router.push('/auth/signin')}
                >
                  Sign In
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="flex flex-col items-center gap-2">
                  <Button variant="ghost" size="icon">
                    <Bell className="h-4 w-4" />
                    <span className="sr-only">Notifications</span>
                  </Button>
                  <ThemeToggle />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push('/auth/signin')}
                  className="h-8 w-8"
                >
                  <User className="h-4 w-4" />
                  <span className="sr-only">Sign In</span>
                </Button>
              </div>
            )}
          </>
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
              {isAuthenticated ? (
                <>
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
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={user?.avatar || ''} alt={user?.name || ''} />
                      <AvatarFallback>{user?.name?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                    <span>{user?.name || 'User'}</span>
                  </Link>
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="icon">
                      <Bell className="h-4 w-4" />
                      <span className="sr-only">Notifications</span>
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => {
                      handleLogout();
                      setSheetOpen(false);
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign Out</span>
                  </Button>
                </>
              ) : (
                <Button
                  variant="default"
                  className="w-full"
                  onClick={() => {
                    router.push('/auth/signin');
                    setSheetOpen(false);
                  }}
                >
                  Sign In
                </Button>
              )}
              <div className="flex items-center justify-end">
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