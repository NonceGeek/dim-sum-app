import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Settings, LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { LoginDialog } from "@/components/dialogs/login-dialog";
import { RoleSelectDialog, UserRole } from "@/components/dialogs/role-select-dialog";

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
  const [showRoleSelect, setShowRoleSelect] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setShowLoginDialog(true);
  };

  const handleLoginClose = () => {
    setShowLoginDialog(false);
    setSelectedRole(null);
  };

  return (
    <div className="border-t p-4 space-y-4">
      {isAuthenticated ? (
        <>
          {open ? (
            <>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-primary w-full cursor-pointer",
                  activeSubmenu ? "bg-primary/10 text-primary" : "hover:bg-primary/5"
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
                <span>Sign Out</span>
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
                <span className="sr-only">Sign Out</span>
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          {open ? (
            <Button
              variant="default"
              className="w-full"
              onClick={() => setShowRoleSelect(true)}
            >
              Sign In
            </Button>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowRoleSelect(true)}
                className="h-8 w-8"
              >
                <User className="h-4 w-4" />
                <span className="sr-only">Sign In</span>
              </Button>
            </div>
          )}
        </>
      )}

      <RoleSelectDialog
        isOpen={showRoleSelect}
        onClose={() => setShowRoleSelect(false)}
        onConfirm={handleRoleSelect}
      />

      {selectedRole && (
        <LoginDialog
          isOpen={showLoginDialog}
          onClose={handleLoginClose}
          callbackUrl={`/?role=${selectedRole}`}
          role={selectedRole}
        />
      )}
    </div>
  );
} 