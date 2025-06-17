import { Header } from '@/components/layout/header';

export default function DocsPage() {
  return (
    <>
      <Header />
      <div className="h-[calc(100vh-56px)] space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold">Docs</h1>
          
        </div>
        <p>The documentation for the AI Dim Sum System.</p>
      </div>
    </>
  );
} 