"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname, Link } from "@/i18n/navigation";
import {
  LayoutDashboard,
  Users,
  Settings,
  Database,
  LogOut,
  Menu,
  X,
  Code,
  FolderOpen,
  Shield,
  FileText,
  ClipboardList,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle/theme-toggle";

const adminNavItems = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Users",
    href: "/admin/users",
    icon: Users,
  },
  {
    title: "Categories",
    href: "/admin/categories",
    icon: FolderOpen,
  },
  {
    title: "Permissions",
    href: "/admin/permissions",
    icon: Shield,
  },
  {
    title: "Corpus Data",
    href: "/admin/corpus",
    icon: Database,
  },
  {
    title: "Corpus Collection",
    href: "/admin/corpus-collection",
    icon: ClipboardList,
    children: [
      { title: "Overview", href: "/admin/corpus-collection" },
      { title: "Activities", href: "/admin/corpus-collection/activities" },
      { title: "Submissions", href: "/admin/corpus-collection/submissions" },
      { title: "Categories", href: "/admin/corpus-collection/categories" },
      { title: "AI Review Batches", href: "/admin/corpus-collection/review-batches" },
      { title: "Analytics", href: "/admin/corpus-collection/analytics" },
    ],
  },
  {
    title: "Audit Logs",
    href: "/admin/audit-logs",
    icon: FileText,
  },
  {
    title: "Rule Ops",
    href: "/admin/rules",
    icon: Code,
  },
  {
    title: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    "/admin/corpus-collection": true,
  });

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user?.isSystemAdmin) {
      router.push("/");
      return;
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session?.user?.isSystemAdmin) {
    return null;
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-border">
          <div className="flex items-center space-x-2">
            <Settings className="w-6 h-6 text-primary" />
            <span className="font-semibold text-lg text-foreground">
              Admin Panel
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-muted-foreground hover:text-foreground hover:bg-accent"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {adminNavItems.map((item) => {
            const isSectionActive =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
            const isExpanded = expandedMenus[item.href] || isSectionActive;

            if (item.children) {
              return (
                <div key={item.href} className="space-y-1">
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                      isSectionActive
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                    onClick={() =>
                      setExpandedMenus((prev) => ({
                        ...prev,
                        [item.href]: !isExpanded,
                      }))
                    }
                  >
                    <span className="flex items-center space-x-3">
                      <item.icon className="w-5 h-5" />
                      <span>{item.title}</span>
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform",
                        isExpanded && "rotate-180",
                      )}
                    />
                  </button>
                  {isExpanded && (
                    <div className="ml-8 space-y-1">
                      {item.children.map((child) => {
                        const isChildActive = pathname === child.href;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              "block rounded-md px-3 py-2 text-sm transition-colors",
                              isChildActive
                                ? "bg-accent text-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-foreground",
                            )}
                            onClick={() => setSidebarOpen(false)}
                          >
                            {child.title}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                  isActive
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center space-x-3 px-3 py-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-foreground">
                {session.user.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {session.user.name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                System Administrator
              </p>
            </div>
          </div>

          <Separator className="my-3 bg-border" />

          <Button
            variant="ghost"
            className="w-full justify-start text-left text-muted-foreground hover:text-foreground hover:bg-accent"
            onClick={() => router.push("/")}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Back to Main App
          </Button>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-card border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden text-muted-foreground hover:text-foreground hover:bg-accent"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-semibold text-foreground">
                Admin Dashboard
              </h1>
            </div>

            <div className="flex items-center space-x-3">
              <ThemeToggle />
              <span className="text-sm text-muted-foreground">
                Welcome back, {session.user.name}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
