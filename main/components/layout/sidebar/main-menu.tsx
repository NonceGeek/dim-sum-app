"use client";

import { SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface MainMenuProps {
  menuItems: Array<{ icon: any; label: string; href: string; children?: Array<{ icon: any; label: string; href: string }> }>;
  pathname: string;
}

export function MainMenu({ menuItems, pathname }: MainMenuProps) {
  const searchParams = useSearchParams();

  // Check if a child href matches the current pathname and search params
  const isChildActive = useMemo(() => {
    return (childHref: string) => {
      const [path, query] = childHref.split("?");
      if (path !== pathname) return false;

      if (!query) return pathname === path && !searchParams.toString();

      const params = new URLSearchParams(query);
      const category = params.get("category");
      const currentCategory = searchParams.get("category");

      return category === currentCategory;
    };
  }, [pathname, searchParams]);

  // Initialize expanded items based on current active child
  const getInitialExpandedItems = () => {
    const initial = new Set<string>();
    menuItems.forEach((item) => {
      if (item.children && item.children.length > 0) {
        const hasActiveChild = item.children.some(child => isChildActive(child.href));
        if (hasActiveChild) {
          initial.add(item.href);
        }
      }
    });
    return initial;
  };

  const [expandedItems, setExpandedItems] = useState<Set<string>>(getInitialExpandedItems);

  // Auto-expand menus based on current active route
  useEffect(() => {
    menuItems.forEach((item) => {
      if (item.children && item.children.length > 0) {
        const hasActiveChild = item.children.some(child => isChildActive(child.href));
        const isOnParentPage = pathname === item.href;

        if (hasActiveChild || isOnParentPage) {
          setExpandedItems(prev => {
            if (!prev.has(item.href)) {
              return new Set([...prev, item.href]);
            }
            return prev;
          });
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  const toggleExpanded = (href: string) => {
    setExpandedItems(prev => new Set([...prev, href]));
  };

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {menuItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedItems.has(item.href);
            const isActive = pathname === item.href || (hasChildren && item.children?.some(child => isChildActive(child.href)));

            return (
              <SidebarMenuItem key={item.href}>
                {hasChildren ? (
                  <>
                    <SidebarMenuButton asChild>
                      <Link
                        href={item.href}
                        onClick={() => toggleExpanded(item.href)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-sidebar-foreground",
                          isActive
                            ? "bg-sidebar-accent-foreground/50 text-sidebar-foreground hover:bg-sidebar-accent-foreground/50"
                            : "hover:bg-sidebar-accent-foreground/10"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 shrink-0 transition-transform",
                            isExpanded && "rotate-90"
                          )}
                        />
                      </Link>
                    </SidebarMenuButton>
                    {isExpanded && (
                      <SidebarMenuSub>
                        {item.children!.map((child) => (
                          <SidebarMenuSubItem key={child.href}>
                            <SidebarMenuSubButton asChild>
                              <Link
                                href={child.href}
                                className={cn(
                                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-sidebar-foreground",
                                  isChildActive(child.href)
                                    ? "bg-sidebar-accent-foreground/50 text-sidebar-foreground hover:bg-sidebar-accent-foreground/50"
                                    : "hover:bg-sidebar-accent-foreground/10"
                                )}
                              >
                                <child.icon className="h-4 w-4 shrink-0" />
                                <span>{child.label}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                  </>
                ) : (
                  <SidebarMenuButton asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-sidebar-foreground",
                        pathname === item.href
                          ? "bg-sidebar-accent-foreground/50 text-sidebar-foreground hover:bg-sidebar-accent-foreground/50"
                          : "hover:bg-sidebar-accent-foreground/10"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
} 