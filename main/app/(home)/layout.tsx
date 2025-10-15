import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/header";

export default function MainMenuLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <div className="flex-1 overflow-auto">{children}</div>
      <Footer />
    </>
  );
}
