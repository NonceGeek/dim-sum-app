"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Loader, Pause, Play, Search, Star } from "lucide-react";
import Image from "next/image";
import { motion } from "motion/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  corpusInteractApi,
  IUpdateInteractProps,
} from "@/lib/api/corpus-interact";
import { Skeleton } from "@/components/ui/skeleton";
import { format, set } from "date-fns";
import { Slider } from "@/components/ui/slider2";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
// const SampleItems = [
//   {
//     type: "Video",
//     title: "The Art of Public Speaking",
//     date: "Apr 20",
//     image: "/speaker.jpg",
//   },
//   {
//     type: "Word",
//     title: "ubiquitous",
//     desc: "present, appearing, or found everywhere",
//     date: "Apr 20",
//     icon: <Volume2 className="h-5 w-5 text-blue-400" />,
//   },
//   {
//     type: "Phrase",
//     title: "Break the ice",
//     desc: "It’s a good idea to break the ice with a funny story.",
//     date: "Apr 20",
//   },
//   {
//     type: "Audio",
//     title: "Ancient Chinese Poetry",
//     date: "Apr 20",
//     player: true,
//   },
// ];
export default function MyRecordPage() {
  const [activeTab, setActiveTab] = useState("Bookmarked");
  const [category, setCategory] = useState("All");
  let categories = [];
  const tabs = [
    { value: "Bookmarked", label: "My Favorites" },
    { value: "Liked", label: "My Likes" },
  ];
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);
  // const audio = audioRef.current;
  const [loaded, setLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [liked, setLiked] = useState(true);
  const [bookmarked, setBookmarked] = useState(true);
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  // console.log("audio:", audioRef);

  const mutation = useMutation({
    mutationFn: async ({
      corpus_unique_id,
      is_liked,
      is_bookmarked,
    }: IUpdateInteractProps) => {
      return await corpusInteractApi.updateInteract({
        corpus_unique_id,
        is_liked,
        is_bookmarked,
      });
    },
  });

  const getList = useQuery({
    queryKey: ["my-record", activeTab, page, search],
    queryFn: async () => {
      const res = await corpusInteractApi[`get${activeTab}List`](
        page,
        PAGE_SIZE,
        search
      );
      return res;
    },
  });

  const data = getList.data?.results.map((item) => {
    if (item.corpus.note.context.audio) {
      item.type = "Audio";
      categories = [...new Set([...categories, "All", "Audio"])];
    }
    return item;
  });

  const items = (data || []).filter((item) =>
    category === "All" ? true : item.type === category
  );

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (audio.paused) {
        audio.play();
        setIsPlaying(true);
      } else {
        audio.pause();
        setIsPlaying(false);
      }
    } catch (e) {
      console.log("播放失败:", e);
    }
  };
  const handleSeek = (val) => {
    setProgress(Number(val));
  };
  const handleSeekStart = () => {
    setIsSeeking(true);
  };

  const handleSeekEnd = (val) => {
    const audio = audioRef.current;
    const value = Number(val);
    audio.currentTime = value;
    setProgress(value);
    setIsSeeking(false);
  };
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (!isSeeking) {
        setProgress(audio.currentTime);
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [audioRef.current, isSeeking]);

  function debounce(fn: Function, delay = 500) {
    let timer: NodeJS.Timeout;
    return function (...args: any[]) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  const handleClick = (corpus_unique_id, name: string) => {
    if (name === "like") setLiked(true);
    if (name === "dislike") setLiked(false);
    if (name === "bookmark") setBookmarked(true);
    if (name === "disbookmark") setBookmarked(false);

    handleProtectedClick(corpus_unique_id, name);
  };

  const handleProtectedClick = debounce(
    async (corpus_unique_id: string, name: string) => {
      try {
        await mutation.mutateAsync({
          corpus_unique_id,
          ...(name === "like"
            ? { is_liked: true }
            : name === "dislike"
              ? { is_liked: false }
              : {}),
          ...(name === "bookmark"
            ? { is_bookmarked: true }
            : name === "disbookmark"
              ? { is_bookmarked: false }
              : {}),
        });
      } catch (err) {
        console.error("操作失败", err);

        if (name === "like") setLiked(false);
        if (name === "dislike") setLiked(true);
        if (name === "bookmark") setBookmarked(false);
        if (name === "disbookmark") setBookmarked(true);

        toast("Failed, please try again later.");
      }
    },
    500
  );

  const handleSearch = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setSearch(input);
    }
  };

  return (
    <>
      <div className="container mx-auto px-4 py-8 flex flex-col min-h-screen">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">My Record</h1>
        </div>

        <div className="grid gap-6 flex-1">
          <Card className="p-6 bg-card transition-all duration-200 hover:shadow-lg h-full">
            <div className="relative w-sm mx-auto">
              <div className="flex border-b relative">
                {tabs.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={`flex-1 text-center py-2 relative ${
                      activeTab === tab.value ? "text-white" : "text-gray-500"
                    }`}
                  >
                    {tab.label}
                    {activeTab === tab.value && (
                      <motion.div
                        layoutId="indicator"
                        className="absolute bottom-0 left-0 w-full h-[2px] bg-primary"
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 30,
                        }}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full mx-auto">
              <div className="relative w-120 mx-auto flex items-center rounded-lg bg-gray-800 transition-all duration-200 focus-within:ring-2 focus-within:ring-muted-foreground focus-within:border-muted-foreground">
                <Search className="w-4 text-gray-400 ml-4" />
                <Input
                  type="search"
                  value={input}
                  placeholder="Search"
                  className="bg-gray-800 border-none text-white w-full focus-visible::border-none focus-visible:ring-0"
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => handleSearch(e)}
                />
              </div>
              {/* 分类按钮 */}
              <div className="flex flex-wrap gap-2 my-6 justify-center">
                {getList.isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton
                        key={i}
                        className="w-20 h-8 rounded-full bg-gray-700"
                      />
                    ))
                  : categories.map((cat) => (
                      <button
                        key={cat}
                        className={`px-4 py-1.5 rounded-full text-sm cursor-point ${
                          cat === category
                            ? "bg-primary text-white"
                            : "bg-gray-800 text-gray-300"
                        }`}
                        onClick={() => setCategory(cat)}
                      >
                        {cat}
                      </button>
                    ))}
              </div>
              {/* 内容网格 */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {getList.isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <Card
                        key={i}
                        className="bg-gray-800 border-none text-white flex flex-col justify-between"
                      >
                        <CardContent className="p-4 flex flex-col flex-1">
                          <Skeleton className="w-full h-40 mb-3 rounded-md" />
                          <Skeleton className="w-1/3 h-4 mb-1" />
                          <Skeleton className="w-full h-5 mb-2" />
                          <Skeleton className="w-1/2 h-4 mb-3" />
                          <Skeleton className="w-full h-6 mt-auto" />
                        </CardContent>
                      </Card>
                    ))
                  : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items?.map((item, i) => {
                  const lyricsOriginal = item?.corpus?.note?.context?.lyric || [
                    { sec: 0 },
                  ];
                  const duration = lyricsOriginal.reduce((acc, cur) => {
                    acc += cur.sec;
                    return acc;
                  }, 0);
                  return (
                    <Card
                      key={i}
                      className="bg-gray-800 border-none text-white flex flex-col justify-between"
                    >
                      <CardContent className="p-4 flex flex-col flex-1">
                        {item.image && (
                          <Image
                            src={item.image}
                            alt={item.title}
                            width={400}
                            height={200}
                            className="rounded-md mb-3"
                          />
                        )}
                        <p className="text-sm text-gray-400 mb-1">
                          {item.type}
                        </p>
                        <Link
                          href={`/yueSong?id=${item.corpus.unique_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <h3 className="text-lg font-semibold hover:underline hover:underline-offset-4">
                            {item.corpus.data}
                          </h3>
                        </Link>
                        {item?.corpus?.note?.context?.song_name_pin && (
                          <p className="text-gray-400 text-sm mt-1">
                            {item.corpus.note.context.song_name_pin}
                          </p>
                        )}
                        {item.icon && (
                          <div className="mt-3 flex items-center">
                            {item.icon}
                          </div>
                        )}
                        {item?.corpus?.note?.context?.audio && (
                          <div className="mt-3 flex items-center gap-2">
                            {!isPlaying ? (
                              loaded ? (
                                <Play
                                  className="h-4 w-4 text-gray-300 cursor-pointer"
                                  onClick={togglePlay}
                                />
                              ) : (
                                <Loader className="h-4 w-4 text-gray-300" />
                              )
                            ) : (
                              <Pause
                                className="h-4 w-4 text-gray-300 cursor-pointer"
                                onClick={togglePlay}
                              />
                            )}
                            <Slider
                              value={[progress]}
                              max={duration}
                              step={1}
                              className="w-[80%] mx-auto"
                              onValueChange={handleSeek}
                              onValueCommit={(val) => handleSeekEnd(val[0])}
                              onPointerDown={handleSeekStart}
                            />
                            <audio
                              ref={audioRef}
                              controls
                              src={item?.corpus?.note?.context?.audio}
                              className="hidden"
                              preload="auto"
                              onCanPlay={() => {
                                console.log("监听 canplay");
                                setLoaded(true);
                              }}
                              onLoadedMetadata={() =>
                                console.log(
                                  "loadedmetadata",
                                  audioRef.current.duration
                                )
                              }
                              onError={(e) => console.log("audio error", e)}
                              onEnded={() => {
                                setIsPlaying(false);
                                setProgress(0);
                              }}
                            />

                            <span className="text-sm text-gray-400 w-6">
                              {Math.trunc(duration - progress)}s
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between mt-auto items-end pt-2">
                          <p className="text-gray-500 text-sm">
                            {activeTab === "Bookmarked" ? "Favorited" : "Liked"}{" "}
                            on{" "}
                            {format(
                              new Date(item.interaction_updated_at),
                              "MMM d, yyyy"
                            )}
                          </p>
                          {activeTab === "Bookmarked" ? (
                            <Star
                              className={cn(
                                "cursor-pointer",
                                bookmarked
                                  ? "text-yellow-400 fill-yellow-400 cursor-pointer"
                                  : "cursor-pointer"
                              )}
                              onClick={() =>
                                handleClick(
                                  item.corpus.unique_id,
                                  bookmarked ? "disbookmark" : "bookmark"
                                )
                              }
                            />
                          ) : (
                            <Heart
                              className={cn(
                                "h-5 w-5 cursor-pointer",
                                liked
                                  ? "text-red-400 fill-red-400 cursor-pointer"
                                  : "cursor-pointer"
                              )}
                              onClick={() =>
                                handleClick(
                                  item.corpus.unique_id,
                                  liked ? "dislike" : "like"
                                )
                              }
                            />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {items.length === 0 && !getList.isLoading && (
                <div className="text-center text-muted-foreground py-20">
                  {search
                    ? "No relevant results were found."
                    : `You haven’t ${activeTab === "Bookmarked" ? "favorited" : "liked"} anything yet.`}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
