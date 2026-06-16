import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { HamburgerMenuContent } from "@/components/layout/hamburger-menu-content";

export default function MobileSheetContent({
  onClose,
}: {
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <Link href="/">
        <div className="flex h-14 items-center border-b px-4">
          <Image
            src="/logo.png"
            alt="DimSum AI Labs Logo"
            width={24}
            height={24}
            className="rounded-sm"
          />
          <span className="ml-2 text-sm font-medium">DimSum AI</span>
        </div>
      </Link>
      <nav className="flex-1 overflow-auto py-4 px-3 space-y-1">
        <HamburgerMenuContent onNavClick={onClose} />
      </nav>
    </div>
  );
}
