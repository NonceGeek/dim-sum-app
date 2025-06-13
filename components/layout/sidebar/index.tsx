"use client";

// import { ThemeToggle } from "@/components/theme-toggle/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Sidebar,
  SidebarContent as SidebarContentBase,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  ArrowLeft,
} from "lucide-react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSidebarStore } from "@/stores/use-sidebar-store";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { signOut } from "next-auth/react";
import { SidebarHeader } from "./sidebar-header";
import { MainMenu } from "./main-menu";
import { SubMenu } from "./sub-menu";
import { UserSection } from "./user-section";
import { menuItems, accountSubmenuItems, workplaceSubmenuItems } from "./menu-config";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { open, setOpen } = useSidebar();
  const {
    isOpen,
    setOpen: setSheetOpen,
    isMobile,
    setMobile,
  } = useSidebarStore();
  const { user, isAuthenticated, clearUser } = useAuthStore();
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      setMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [setMobile]);

  useEffect(() => {
    const isAccountPath = accountSubmenuItems.some(item => pathname === item.href);
    const isWorkplacePath = workplaceSubmenuItems.some(item => pathname === item.href);
    
    if (isAccountPath) {
      setActiveSubmenu('account');
    } else if (isWorkplacePath) {
      setActiveSubmenu('workplace');
    } else {
      setActiveSubmenu(null);
    }
  }, [pathname]);

  const handleLogout = async () => {
    await signOut({ redirect: false });
    clearUser();
    router.push("/");
  };

  const SidebarContent = () => (
    <>
      <SidebarHeader
        activeSubmenu={activeSubmenu}
        open={open}
        setOpen={setOpen}
        setActiveSubmenu={setActiveSubmenu}
      />
      <SidebarContentBase>
        {activeSubmenu ? (
          <SubMenu
            accountSubmenuItems={accountSubmenuItems}
            workplaceSubmenuItems={workplaceSubmenuItems}
            pathname={pathname}
            open={open}
          />
        ) : (
          <MainMenu menuItems={menuItems} pathname={pathname} />
        )}
      </SidebarContentBase>
      <UserSection
        isAuthenticated={isAuthenticated}
        user={user}
        activeSubmenu={activeSubmenu}
        setActiveSubmenu={setActiveSubmenu}
        open={open}
        handleLogout={handleLogout}
        router={router}
      />
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex h-full flex-col">
            <div className="flex h-14 items-center border-b px-4">
              <div className="flex items-center gap-2 w-full">
                {activeSubmenu && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setActiveSubmenu(null)}
                    className="h-8 w-8"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sr-only">Back to main menu</span>
                  </Button>
                )}
                <div className="flex items-center gap-2 flex-1 justify-center">
                  <Image
                    src="/logo.png"
                    alt="DimSum AI Labs Logo"
                    width={24}
                    height={24}
                    className="rounded-sm"
                  />
                  {!activeSubmenu && <span className="text-sm font-medium">DimSum AI Labs</span>}
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-auto py-2">
              <SidebarContentBase>
                {activeSubmenu ? (
                  <SubMenu
                    accountSubmenuItems={accountSubmenuItems}
                    workplaceSubmenuItems={workplaceSubmenuItems}
                    pathname={pathname}
                    open={true}
                  />
                ) : (
                  <MainMenu menuItems={menuItems} pathname={pathname} />
                )}
              </SidebarContentBase>
            </div>
            <UserSection
              isAuthenticated={isAuthenticated}
              user={user}
              activeSubmenu={activeSubmenu}
              setActiveSubmenu={setActiveSubmenu}
              open={true}
              handleLogout={handleLogout}
              router={router}
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sidebar collapsible="icon" className={`${activeSubmenu ? 'bg-sidebar-accent-background' : 'bg-sidebar-background'}`}>
      <SidebarContent />
    </Sidebar>
  );
}
