import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface SubMenuProps {
  accountSubmenuItems: Array<{ icon: any; label: string; href: string }>;
  workplaceSubmenuItems: Array<{ icon: any; label: string; href: string }>;
  pathname: string;
  open: boolean;
}

export function SubMenu({
  accountSubmenuItems,
  workplaceSubmenuItems,
  pathname,
  open,
}: SubMenuProps) {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <div>
          {open ? (
            <>
              <div className="px-3 py-2">
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  Account
                </div>
                <SidebarMenu>
                  {accountSubmenuItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-all hover:text-sidebar-foreground",
                            pathname === item.href
                              ? "bg-sidebar-accent-foreground/50 text-sidebar-foreground hover:bg-sidebar-accent-foreground/50"
                              : "hover:bg-sidebar-accent-foreground/10"
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </div>
              <div className="px-3 py-2">
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  Workplace
                </div>
                <SidebarMenu>
                  {workplaceSubmenuItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-all hover:text-sidebar-foreground",
                            pathname === item.href
                              ? "bg-sidebar-accent-foreground/50 text-sidebar-foreground hover:bg-sidebar-accent-foreground/50"
                              : "hover:bg-sidebar-accent-foreground/10"
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </div>
            </>
          ) : (
            <>
              <div>
                <SidebarMenu>
                  {accountSubmenuItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-all hover:text-sidebar-foreground",
                            pathname === item.href
                              ? "bg-sidebar-accent-foreground/50 text-sidebar-foreground hover:bg-sidebar-accent-foreground/50"
                              : "hover:bg-sidebar-accent-foreground/10"
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="sr-only">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </div>
              <div>
                <SidebarMenu>
                  {workplaceSubmenuItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-all hover:text-sidebar-foreground",
                            pathname === item.href
                              ? "bg-sidebar-accent-foreground/50 text-sidebar-foreground hover:bg-sidebar-accent-foreground/50"
                              : "hover:bg-sidebar-accent-foreground/10"
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="sr-only">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </div>
            </>
          )}
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
