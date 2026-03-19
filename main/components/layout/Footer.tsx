import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/theme-toggle/theme-toggle";

const footerLinks: Record<string, Array<{ label: string; href: string; external?: boolean }>> = {
  Website: [
    { label: "Home", href: "/" },
    { label: "Library", href: "/library" },
    { label: "App Store", href: "/appStore" },
    { label: "Docs", href: "/docs" },
  ],
  Company: [
    { label: "About", href: "https://aidimsum.com/", external: true },
    { label: "Terms", href: "/terms" },
    { label: "Privacy", href: "/privacy" },
  ],
  Resources: [
    { label: "Documentation", href: "/docs" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Image
                src="/logo.png"
                alt="DimSum AI Labs Logo"
                width={24}
                height={24}
              />
              <span className="font-semibold text-sm">DimSum AI Labs</span>
            </div>
            <ThemeToggle />
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {category}
              </h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} DIMSUM AI Labs. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            苏ICP备2025170597号
          </p>
        </div>
      </div>
    </footer>
  );
}
