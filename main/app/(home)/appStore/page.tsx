// Add the "use client" directive to make this a client component
"use client"

import { useState, useEffect } from "react";
import { Header } from '@/components/layout/header';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  type: string;
  wechat_micro_app: string;
  example_img: string;
  pinned: boolean;
  localed: boolean;
}

// Create a client component for the app card
function AppCard({ app }: { app: App }) {
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [exampleDialogOpen, setExampleDialogOpen] = useState(false);
  
  const getTypeDisplay = (type: string): string => {
    switch (type.toUpperCase()) {
      case "STUDY":
        return "学习";
      case "TOOL":
        return "工具";
      case "GAME":
        return "游戏";
      default:
        return type;
    }
  };

  const getLaunchButton = () => {
    if (app.wechat_micro_app) {
      return (
        <>
          <button 
            onClick={() => setQrDialogOpen(true)} 
            className="text-blue-600 hover:underline"
          >
            👉 启动应用（小程序）
          </button>
          <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>微信小程序二维码</DialogTitle>
              </DialogHeader>
              <div className="flex items-center justify-center p-4">
                <Image
                  src={app.wechat_micro_app}
                  alt="WeChat QR Code"
                  width={200}
                  height={200}
                  className="rounded-lg"
                  unoptimized
                />
              </div>
            </DialogContent>
          </Dialog>
        </>
      );
    }

    
    if (app.example_img) {
      return (
        <>
          <button 
            onClick={() => setExampleDialogOpen(true)} 
            className="text-green-600 hover:underline ml-2"
          >
            👉 启动应用
          </button>
          <Dialog open={exampleDialogOpen} onOpenChange={setExampleDialogOpen}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>应用页面</DialogTitle>
              </DialogHeader>
              <div className="flex items-center justify-center p-4">
                <Image
                  src={app.example_img}
                  alt="App Example"
                  width={600}
                  height={400}
                  className="rounded-lg max-w-full h-auto"
                  unoptimized
                />
              </div>
            </DialogContent>
          </Dialog>
        </>
      );
    }

    return (
      <a 
        href={app.url} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="text-blue-600 hover:underline"
      >
        👉 {app.localed ? "启动应用" : "启动应用（国际版）"}
      </a>
    );
  };

  const getExampleButton = () => {
    
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow relative">
      {app.pinned && (
        <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 text-white rounded-md text-xs z-10">
          置顶
        </div>
      )}
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
        <a href={app.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
          <h3 className="text-xl font-semibold">{app.name}</h3>
        </a>
        <p className="text-gray-600 mb-2">By {app.authors.join(", ")}</p>
        <p className="text-gray-600 mb-2 h-16 overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-gray-100">
          {app.description}
        </p>
        {app.type && (
          <div className="mb-4">
            <span className="px-2 py-1 bg-gray-500 dark:bg-gray-600 text-white rounded-full text-xs border border-gray-400 dark:border-gray-500">
              {getTypeDisplay(app.type)}
            </span>
          </div>
        )}
        <div className="flex justify-between text-sm text-gray-500">
          {/* <span>❤️ {app.likes}</span> */}
          <div className="flex">
            {getLaunchButton()}
            {getExampleButton()}
          </div>
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
        const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + "/corpus_apps");
        const data = await response.json();
        // Sort the data to put pinned items first
        const sortedData = data.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return 0;
        });
        setApps(sortedData);
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
        <div className="flex items-center justify-center w-full mb-8">
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