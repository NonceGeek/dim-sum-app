"use client";

import Link from "next/link";
import Image from "next/image";
import { Search, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSidebarStore } from "@/stores/use-sidebar-store";
import { usePathname } from "next/navigation";

interface HeaderProps {
  showLogo?: boolean;
}

export function Header({ showLogo = false }: HeaderProps) {
  const setOpen = useSidebarStore((state) => state.setOpen);
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-transparent backdrop-blur-md supports-[backdrop-filter]:bg-transparent">
      <div className="container mx-auto px-4 flex h-14 items-center">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
          {showLogo && (
            <Link className="flex items-center space-x-2" href="/">
              <Image
                src="/logo.png"
                alt="DimSum AI Labs Logo"
                width={24}
                height={24}
                className="w-6 h-6"
              />
              <span className="font-bold">DimSum AI Labs</span>
            </Link>
          )}
        </div>
        {!isHomePage && (
          <div className="flex flex-1 items-center justify-end space-x-2">
            {/* <div className="w-full max-w-sm">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search..." className="pl-8" />
              </div>
            </div> */}
              <Link className="flex items-center space-x-2" href="/">
                <Image
                  src="/logo.png"
                  alt="DimSum AI Labs Logo"
                  width={24}
                  height={24}
                  className="w-6 h-6"
                />
                <span className="font-bold">DimSum AI Labs</span>
              </Link>
          </div>
        )}
      </div>
    </header>
  );
}
