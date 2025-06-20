// Add the "use client" directive to make this a client component
"use client"

import { useState, useEffect } from "react";
import { Header } from '@/components/layout/header';
import Image from 'next/image';

// Define App interface for type safety
interface App {
  id: number;
  name: string;
  description: string;
  authors: string[];
  url: string;
  homepage_url: string;
  github_url: string;
  intro_video: string | null;
  created_at: string;
  updated_at: string;
  likes: number;
  icon_img: string;
}

// Create a client component for the app card
function AppCard({ app }: { app: App }) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div className="h-48 bg-gray-200 relative">
        <Image 
          src={app.icon_img} 
          alt={`Icon of ${app.name}`}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = 'https://via.placeholder.com/300x200?text=No+Image';
          }}
          width={300}
          height={200}
          unoptimized
        />
      </div>
      <div className="p-4">
      <a href={app.url} target="_blank" rel="noopener noreferrer" className="hover:underline"> <h3 className="text-xl font-semibold">{app.name}</h3></a>
        <p className="text-gray-600 mb-2">By {app.authors.join(", ")}</p>
        <p className="text-gray-700 text-sm mb-4 line-clamp-2 h-10 overflow-hidden">{app.description}</p>
        <div className="flex justify-between text-sm text-gray-500">
          <span>❤️ {app.likes}</span>
          <a href={app.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">👉 启动应用</a>
        </div>
      </div>
    </div>
  );
}

// Keep the main page component as a server component
export default function AppStorePage() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const response = await fetch("https://dim-sum-prod.deno.dev/corpus_apps");
        const data = await response.json();
        setApps(data);
      } catch (error) {
        console.error("Error fetching apps:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchApps();
  }, []);

  return (
    <>
      <div className="h-full p-6 overflow-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">应用商店</h1>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-xl text-gray-500">Loading apps...</p>
          </div>
        ) : apps.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-xl text-gray-500">No apps found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {apps.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        )}
      </div>
    </>
  );
} 