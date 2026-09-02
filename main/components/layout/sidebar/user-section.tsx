import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface UserSectionProps {
  isAuthenticated: boolean;
  user: any;
  activeSubmenu: string | null;
  setActiveSubmenu: (submenu: string | null) => void;
  open: boolean;
  handleLogout: () => void;
  router: any;
}

export function UserSection({
  isAuthenticated,
  user,
  activeSubmenu,
  setActiveSubmenu,
  open,
  handleLogout,
  router,
}: UserSectionProps) {
  const tCommon = useTranslations('Common');

  if (!isAuthenticated) return null;

  return (
    <div className="border-t p-4 space-y-4">
      {open ? (
        <>
          <div
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-all hover:text-sidebar-foreground w-full cursor-pointer",
              activeSubmenu ? "bg-sidebar-accent-foreground/50 text-sidebar-foreground hover:bg-sidebar-accent-foreground/50" : "hover:bg-sidebar-accent-foreground/10"
            )}
            onClick={() => {
              setActiveSubmenu(activeSubmenu ? null : "Account");
              router.push("/account/profile");
            }}
          >
            <div className="flex items-center w-full justify-between gap-2">
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage
                    src={user?.avatar || ""}
                    alt={user?.name || ""}
                  />
                  <AvatarFallback>
                    {user?.name?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                <span>{user?.name || "User"}</span>
              </div>
              <Settings className="h-4 w-4" />
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>{tCommon('signOut')}</span>
          </Button>
        </>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div
            className="cursor-pointer"
            onClick={() => {
              setActiveSubmenu(activeSubmenu ? null : "Account");
              router.push("/account/profile");
            }}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={user?.avatar || ""}
                alt={user?.name || ""}
              />
              <AvatarFallback>{user?.name?.[0] || "U"}</AvatarFallback>
            </Avatar>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            <span className="sr-only">{tCommon('signOut')}</span>
          </Button>
        </div>
      )}
    </div>
  );
}
