import { Header } from "@/components/layout/header";

export default function MainMenuLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <div className="h-[calc(100vh-56px)] flex overflow-hidden">
        {children}
      </div>
    </>
  );
}
