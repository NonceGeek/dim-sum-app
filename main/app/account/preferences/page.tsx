import { Header } from '@/components/layout/header';

export default function PreferencesPage() {
  return (
    <>
      <Header />
      <div className="h-[calc(100vh-56px)] space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold">Preferences</h1>
        </div>
      </div>
    </>
  );
} 