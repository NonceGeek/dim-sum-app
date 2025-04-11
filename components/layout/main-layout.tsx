import { ReactNode } from "react";
import { AppSidebar } from "./sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="h-full w-full flex flex-col">
        <div className="flex flex-1 h-full overflow-hidden">
          <AppSidebar />
          <main className="h-screen w-full overflow-hidden">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
