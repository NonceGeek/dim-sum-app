import { SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface MainMenuProps {
  menuItems: Array<{ icon: any; label: string; href: string }>;
  pathname: string;
}

export function MainMenu({ menuItems, pathname }: MainMenuProps) {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
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
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
} 