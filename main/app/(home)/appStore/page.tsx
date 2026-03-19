// Add the "use client" directive to make this a client component
"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowBigRight, Link, Video } from "lucide-react";

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
  sorting: number;
}
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

// Create a client component for the app card
function AppCard({ app }: { app: App }) {
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [exampleDialogOpen, setExampleDialogOpen] = useState(false);

  const getLaunchButton = () => (
    <>
      {app.homepage_url && (
        <a
          href={app.homepage_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700        
  border-b border-transparent hover:border-current transition-all duration-200 cursor-pointer"
        >
          <Link className="w-4 h-4 shrink-0" />
          应用主页
        </a>
      )}
      {app.wechat_micro_app && (
        <>
          <button
            onClick={() => setQrDialogOpen(true)}
            className="inline-flex items-center text-blue-600 hover:text-blue-700        
  border-b border-transparent hover:border-current transition-all duration-200 cursor-pointer"
          >
            <ArrowBigRight className="w-4 h-4 shrink-0" />
            启动应用（小程序）
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
      )}

      {app.example_img && (
        <>
          <button
            onClick={() => setExampleDialogOpen(true)}
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700        
  border-b border-transparent hover:border-current transition-all duration-200 cursor-pointer"
          >
            <Video className="w-4 h-4 shrink-0" />
            <span>演示视频</span>
          </button>
          <Dialog open={exampleDialogOpen} onOpenChange={setExampleDialogOpen}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>应用页面</DialogTitle>
              </DialogHeader>
              <div className="flex items-center justify-center p-4">
                {app.example_img.endsWith(".mp4") ? (
                  <video
                    src={app.example_img}
                    width={600}
                    height={400}
                    className="rounded-lg max-w-full h-auto"
                    controls
                    preload="metadata"
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : null}
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}

      {app.url && (
        <a
          href={app.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-green-600 hover:text-green-700        
  border-b border-transparent hover:border-current transition-all duration-200 cursor-pointer"
        >
          <ArrowBigRight className="w-4 h-4 shrink-0" />
          {app.localed ? "启动应用" : "启动应用（国际版）"}
        </a>
      )}
    </>
  );

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
        <a
          href={app.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group text-xl font-semibold text-gray-900 relative pb-1          
  inline-block"
        >
          <h3 className="text-xl font-semibold">{app.name}</h3>
          <span
            className="absolute bottom-0 left-0 w-full h-0.5 bg-current scale-x-0 
  group-hover:scale-x-100 transition-transform duration-300 origin-center"
          />
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
          <div className="flex flex-row gap-4 flex-wrap">
            {getLaunchButton()}
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
  const [selectedType, setSelectedType] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();

  // Initialize selectedType from URL params
  useEffect(() => {
    const category = searchParams.get("category") || "";
    setSelectedType(category);
  }, [searchParams]);

  // Update URL when selectedType changes
  const handleTypeChange = (value: string) => {
    const newValue = value === "全部" ? "" : value;
    setSelectedType(newValue);

    const params = new URLSearchParams(searchParams.toString());
    if (newValue) {
      params.set("category", newValue);
    } else {
      params.delete("category");
    }
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const minTypeCount = 1; // 最小类型计数阈值
  const types = useMemo(() => {
    const typeCounts = apps
      .map((app: App) => getTypeDisplay(app.type))
      .reduce(
        (acc, type) => {
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
    return Object.entries(typeCounts)
      .filter(([_, count]) => count >= minTypeCount)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [apps]);

  const filteredApps = useMemo(() => {
    if (!selectedType) return apps;
    if (selectedType === "其他")
      return apps.filter(
        (app: App) =>
          !["学习", "游戏", "AI"].includes(getTypeDisplay(app.type)),
      );
    return apps.filter((app: App) => getTypeDisplay(app.type) === selectedType);
  }, [apps, selectedType]);

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
        const sorting_0 = sortedData.filter((app: App) => app.sorting === 0);
        const sorting_others = sortedData
          .filter((app: App) => app.sorting !== 0)
          .sort((a, b) => a.sorting - b.sorting);
        setApps([...sorting_others, ...sorting_0]);
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
          <div className="flex flex-col space-y-4">
            <div className="w-50 ml-auto">
              <Combobox
                items={["全部", ...types.map(t => t.type)]}
                value={selectedType || "全部"}
                onValueChange={handleTypeChange}
              >
                <ComboboxInput placeholder="选择一个标签" />
                <ComboboxContent>
                  <ComboboxEmpty>No items found.</ComboboxEmpty>
                  <ComboboxList>
                    {(item) => {
                      return (
                        <ComboboxItem key={item} value={item}>
                          {getTypeDisplay(item)}
                        </ComboboxItem>
                      );
                    }}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredApps.map((app) => (
                <AppCard key={app.id} app={app} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
} 