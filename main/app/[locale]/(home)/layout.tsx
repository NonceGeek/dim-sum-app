"use client";

import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/header";
import { usePathname } from "@/i18n/navigation";

export default function MainMenuLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isHomepage = pathname === "/";
  const isSearchPage = pathname === "/search";

  // Homepage and search page render their own layout
  if (isHomepage || isSearchPage) {
    return <>{children}</>;
  }

  // 小助手是全高的对话界面：消息区自己滚动，不显示页脚
  if (pathname.startsWith("/assistant")) {
    return (
      <div className="flex h-dvh flex-col">
        <Header />
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="flex-1 overflow-y-auto">{children}</div>
      <Footer />
    </div>
  );
}
