import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/header";

export default function MainMenuLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="flex-1 overflow-y-auto">{children}</div>
      <Footer />
    </div>
  );
}
