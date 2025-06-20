import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface SidebarHeaderProps {
  activeSubmenu: string | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  setActiveSubmenu: (submenu: string | null) => void;
}

export function SidebarHeader({ activeSubmenu, open, setOpen, setActiveSubmenu }: SidebarHeaderProps) {
  const showTitle = !activeSubmenu;

  return (
    <div className="flex h-14 items-center border-b px-4">
      {activeSubmenu ? (
        <div className="flex items-center gap-2 w-full">
          {open ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setActiveSubmenu(null)}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back to main menu</span>
              </Button>
              <Link href="/" className="flex items-center gap-2 flex-1 justify-center">
                <Image
                  src="/logo.png"
                  alt="DimSum AI Labs Logo"
                  width={24}
                  height={24}
                  className="rounded-sm"
                />
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="h-8 w-8"
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
      ) : (
        <>
          {open ? (
            <>
              <Link href="/" className="flex items-center gap-2 flex-1 justify-center">
                <Image
                  src="/logo.png"
                  alt="DimSum AI Labs Logo"
                  width={24}
                  height={24}
                  className="rounded-sm"
                />
                {showTitle && <span className="text-sm font-medium">DimSum AI Labs</span>}
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="h-8 w-8"
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
        </>
      )}
    </div>
  );
} 