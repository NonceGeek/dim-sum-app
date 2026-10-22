"use client";

import { AdminQueryBoundary } from "@/components/admin/admin-query-boundary";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link,usePathname,useRouter } from "@/i18n/navigation";
import { isLibraryOpsPage } from "@/lib/admin-route-access";
import { adminLanding,canAdminPage } from "@/lib/admin/pages";
import { useAdminAccess } from "@/lib/hooks/use-admin-access";
import { useLibraryOps } from "@/lib/hooks/use-library-ops";
import { useSubmissionAccess } from "@/lib/hooks/use-submission-access";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
	BarChart3,
	ChevronDown,
	ClipboardList,
	Code,
	Database,
	FileText,
	FolderOpen,
	Inbox,
	LayoutDashboard,
	LogOut,
	Menu,
	Settings,
	Shield,
	Users,
	X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useEffect,useState } from "react";

const adminNavItems = [
  {
    titleKey: "nav.dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    titleKey: "nav.analytics",
    href: "/admin/analytics",
    icon: BarChart3,
  },
  {
    titleKey: "nav.users",
    href: "/admin/users",
    icon: Users,
  },
  {
    titleKey: "nav.categories",
    href: "/admin/categories",
    icon: FolderOpen,
  },
  {
    titleKey: "nav.permissions",
    href: "/admin/permissions",
    icon: Shield,
    children: [
      {
        titleKey: "nav.administrators",
        href: "/admin/administrators",
        superAdminOnly: true,
      },
      { titleKey: "nav.corpusPermissions", href: "/admin/permissions" },
      {
        titleKey: "corpusNav.submissionPermissions",
        href: "/admin/business-permissions",
      },
      {
        titleKey: "corpusNav.questionnairePermissions",
        href: "/admin/corpus-collection/questionnaire-permissions",
      },
    ],
  },
  {
    titleKey: "nav.corpusData",
    href: "/admin/corpus",
    icon: Database,
  },
  {
    titleKey: "nav.libraryOps",
    href: "/admin/library-ops",
    icon: Inbox,
    children: [
      {
        titleKey: "libraryNav.contributionApplications",
        href: "/admin/contribution-applications",
      },
      { titleKey: "libraryNav.ingestionLeads", href: "/admin/ingestion-leads" },
      {
        titleKey: "libraryNav.contactRequests",
        href: "/admin/dataset-contact-requests",
      },
    ],
  },
  {
    titleKey: "nav.corpusCollection",
    href: "/admin/corpus-collection",
    icon: ClipboardList,
    children: [
      { titleKey: "corpusNav.overview", href: "/admin/corpus-collection" },
      {
        titleKey: "corpusNav.activities",
        href: "/admin/corpus-collection/activities",
      },
      {
        titleKey: "corpusNav.submissions",
        href: "/admin/corpus-collection/submissions",
      },
      {
        titleKey: "corpusNav.comments",
        href: "/admin/corpus-collection/comments",
      },
      {
        titleKey: "corpusNav.categories",
        href: "/admin/corpus-collection/categories",
      },
      {
        titleKey: "corpusNav.reviewBatches",
        href: "/admin/corpus-collection/review-batches",
      },
      {
        titleKey: "corpusNav.analytics",
        href: "/admin/corpus-collection/analytics",
      },
      {
        titleKey: "corpusNav.questionnaireInsights",
        href: "/admin/corpus-collection/questionnaire-insights",
      },
      {
        titleKey: "corpusNav.questionnaireSettings",
        href: "/admin/corpus-collection/questionnaire-settings",
      },
      {
        titleKey: "corpusNav.questionnaireDefinition",
        href: "/admin/corpus-collection/questionnaire-definition",
      },
    ],
  },
  {
    titleKey: "nav.auditLogs",
    href: "/admin/audit-logs",
    icon: FileText,
    children: [
      { titleKey: "nav.permissionAudit", href: "/admin/audit-logs" },
      {
        titleKey: "corpusNav.submissionAudit",
        href: "/admin/corpus-collection/submission-audit",
      },
    ],
  },
  {
    titleKey: "nav.ruleOps",
    href: "/admin/rules",
    icon: Code,
  },
  {
    titleKey: "nav.settings",
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
  const business = useAdminAccess();
  const insights = useQuery({ queryKey: ["questionnaire-access", session?.user?.id], enabled: !!session?.user?.id, retry: false, queryFn: async () => { const r = await fetch("/api/admin/corpus-collection/access", { cache: "no-store" }); return r.ok ? r.json() : null; } });
  const t = useTranslations("AdminLayout");
  const router = useRouter();
  const pathname = usePathname();
  const { data: submissionAccess } = useSubmissionAccess();
  const hasSubmissionAccess = !!submissionAccess;
  const { data: libraryOps } = useLibraryOps();
  const libraryBadges: Record<string, number> = {
    "/admin/contribution-applications":
      libraryOps?.counts.pendingInitialReview ?? 0,
    "/admin/ingestion-leads": libraryOps?.counts.myOpenLeads ?? 0,
    "/admin/dataset-contact-requests":
      libraryOps?.counts.openContactRequests ?? 0,
  };
  const libraryChildAllowed = (href: string) =>
    !!libraryOps &&
    (libraryOps.isAdmin ||
      libraryOps.actions.includes(
        href === "/admin/ingestion-leads"
          ? "ingestion_assignee"
          : "contribution_review",
      ));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [corpusAccess, setCorpusAccess] = useState<boolean | null>(null);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    "/admin/corpus-collection": true,
  });

  // Follow the selected child even when its URL belongs to another route family.
  useEffect(() => {
    const group = adminNavItems.find((item) =>
      item.children?.some(
        (child) =>
          pathname === child.href ||
          (child.href !== "/admin/corpus-collection" &&
            pathname.startsWith(`${child.href}/`)),
      ),
    );
    if (group)
      setExpandedMenus((previous) => ({ ...previous, [group.href]: true }));
  }, [pathname]);

  useEffect(() => {
    if (status === "loading") return;

    if (business.isLoading) return;
    if (business.data && canAdminPage(business.data, pathname)) {
      setCorpusAccess(true);
      if (pathname === "/admin" && !business.data.isPlatformAdmin) router.replace(adminLanding(business.data));
      return;
    }
    setCorpusAccess(null);
    if (isLibraryOpsPage(pathname)) {
      let active = true;
      fetch("/api/admin/library-ops", { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error("denied");
          if (active) setCorpusAccess(true);
        })
        .catch(() => {
          if (active) {
            setCorpusAccess(false);
            router.push("/");
          }
        });
      return () => {
        active = false;
      };
    }
    const submissionPath =
      pathname === "/admin" ||
      pathname === "/admin/corpus-collection" ||
      /^\/admin\/corpus-collection\/(submissions|review-batches)(\/|$)/.test(
        pathname,
      );
    if (submissionPath) {
      let active = true;
      fetch("/api/admin/corpus-collection/submission-access", {
        cache: "no-store",
      })
        .then((response) => {
          if (!response.ok) throw new Error("denied");
          if (active) {
            setCorpusAccess(true);
            if (
              pathname === "/admin" ||
              pathname === "/admin/corpus-collection"
            )
              router.replace("/admin/corpus-collection/submissions");
          }
        })
        .catch(() => {
          if (active) {
            setCorpusAccess(false);
            router.push("/");
          }
        });
      return () => {
        active = false;
      };
    }
    if (
      !pathname.startsWith("/admin/corpus-collection/questionnaire-insights")
    ) {
      router.push("/");
      return;
    }
    let active = true;
    fetch("/api/admin/corpus-collection/access")
      .then((response) => {
        if (!response.ok) throw new Error("denied");
        if (active) setCorpusAccess(true);
      })
      .catch(() => {
        if (active) {
          setCorpusAccess(false);
          router.push("/");
        }
      });
    return () => {
      active = false;
    };
  }, [pathname, session, status, router, business.data, business.isLoading]);

  if (
    status === "loading" ||
    (corpusAccess === null)
  ) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!corpusAccess) {
    return null;
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-card border-r border-border transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-border">
          <div className="flex items-center space-x-2">
            <Settings className="w-6 h-6 text-primary" />
            <span className="font-semibold text-lg text-foreground">
              {t("panelTitle")}
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

        <nav className="flex-1 min-h-0 overflow-y-auto px-4 py-6 space-y-2">
          {adminNavItems
            .filter(item => business.data?.isPlatformAdmin || (item.children ? item.children.some(child => business.data && canAdminPage(business.data,child.href)) : business.data && canAdminPage(business.data,item.href)) || (item.href === "/admin/corpus-collection" && (!!submissionAccess || !!insights.data)))
            .map((item) => {
              const visibleChildren = item.children?.filter((child) => {
                if (
                  "superAdminOnly" in child &&
                  child.superAdminOnly &&
                  !business.data?.isSuperAdmin
                )
                  return false;
                if (item.href === "/admin/library-ops")
                  return libraryChildAllowed(child.href);
                return !!business.data && canAdminPage(business.data, child.href) ||
                  (child.href === "/admin/corpus-collection/questionnaire-insights" && !!insights.data);
              });
              const childActive = (href: string) =>
                pathname === href ||
                (href !== "/admin/corpus-collection" &&
                  pathname.startsWith(`${href}/`));
              const isSectionActive = item.children
                ? visibleChildren?.some((child) => childActive(child.href))
                : pathname === item.href;
              const isExpanded = expandedMenus[item.href] ?? !!isSectionActive;

              if (item.children) {
                return (
                  <div key={item.href} className="space-y-1">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
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
                        <span>{t(item.titleKey)}</span>
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
                        {visibleChildren?.map((child) => {
                          const isChildActive = childActive(child.href);
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              aria-current={isChildActive ? "page" : undefined}
                              className={cn(
                                "block rounded-md px-3 py-2 text-sm transition-colors",
                                isChildActive
                                  ? "bg-accent text-foreground"
                                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
                              )}
                              onClick={() => setSidebarOpen(false)}
                            >
                              <span className="flex items-center justify-between gap-2">
                                {t(child.titleKey)}
                                {!!libraryBadges[child.href] && (
                                  <span className="rounded-full bg-destructive px-1.5 text-xs font-medium leading-5 text-white">
                                    {libraryBadges[child.href] > 99
                                      ? "99+"
                                      : libraryBadges[child.href]}
                                  </span>
                                )}
                              </span>
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
                  <span>{t(item.titleKey)}</span>
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
                {business.data?.isSuperAdmin
                  ? t("roles.superAdministrator")
                  : business.data?.isPlatformAdmin
                    ? t("roles.systemAdministrator")
                    : t("roles.businessOperator")}
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
            {t("backToMainApp")}
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
                {t("dashboardTitle")}
              </h1>
            </div>

            <div className="flex items-center space-x-3">
              <LocaleSwitcher />
              <ThemeToggle />
              <span className="text-sm text-muted-foreground">
                {t("welcomeBack", {
                  name: session.user.name ?? t("unnamedUser"),
                })}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 bg-background">
          <AdminQueryBoundary identity={JSON.stringify(business.data ?? { userId: session.user.id })}>{children}</AdminQueryBoundary>
        </main>
      </div>
    </div>
  );
}
