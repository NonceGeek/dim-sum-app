import { Header } from '@/components/layout/header';

export default function ProfilePage() {
  return (
    <>
      <Header />
      <div className="h-full space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold">Your Profile</h1>
        </div>
      </div>
    </>
  );
} 