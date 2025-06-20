import { Header } from "@/components/layout/header";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--color-accent-background)]">
      <Header titleClassName="text-accent-foreground" />
      <div className="min-h-[calc(100vh-56px)]">
        {children}
      </div>
    </div>
  );
} 