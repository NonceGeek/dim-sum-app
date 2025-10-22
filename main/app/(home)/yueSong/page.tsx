"use client";

import { Card } from "@/components/ui/card";
import {
  ChevronLeft,
  CircleArrowOutUpRight,
  Play,
  FastForward,
  VolumeX,
  Pause,
  Volume2,
  Heart,
  Star,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AudioVisualizer from "./_components/audio-visualizer";
import { Slider } from "@/components/ui/slider2";
import {
  corpusInteractApi,
  IStats,
  IUpdateInteractProps,
} from "@/lib/api/corpus-interact";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { getCorpusItemByUniqueId, SearchResult } from "@/lib/api/search";
import Lyrics from "./_components/lyrics";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { toast } from "sonner";

function YueSong() {
  const searchParams = useSearchParams();
  const uuid = searchParams.get("id");
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const audioRef = useRef<HTMLAudioElement>(null);
  const audio = audioRef.current;
  const [loaded, setLoaded] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [progress, setProgress] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const queryClient = useQueryClient();

  const results = useQueries({
    queries: [
      {
        queryKey: ["yueSongDetails", uuid],
        queryFn: async () => {
          const res = await getCorpusItemByUniqueId(uuid);
          return res;
        },
      },
      {
        queryKey: ["corpus-stats", uuid],
        queryFn: async () => {
          const res = await corpusInteractApi.getStats(uuid);
          return res;
        },
        staleTime: 0,
        refetchOnMount: true,
      },
    ],
  });
  const isLoading = results.some((r) => r.isLoading);
  const [yueSongQuery, corpusStatsQuery] = results;
  const data = yueSongQuery.data as SearchResult;
  const corpusStats = corpusStatsQuery.data as IStats;

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
    onSuccess: (result) => {
      queryClient.setQueryData(
        ["corpus-stats", data.unique_id],
        (old: any) => ({
          ...old,

          user_status: {
            ...old.user_status,
            is_liked: result.interaction.is_liked,
            is_bookmarked: result.interaction.is_bookmarked,
          },
        })
      );
    },
  });

  const lyrics = useMemo(() => {
    const lyricsOriginal = data?.note.context.lyric || [{ sec: 0 }];
    const duration = lyricsOriginal.reduce((acc, cur) => {
      acc += cur.sec;
      return acc;
    }, 0);
    const lyricsCurrent = lyricsOriginal.reduce((acc, cur) => {
      if (!acc.length) {
        acc.push({ ...cur, start: 0 });
      } else {
        const newCur = {
          ...cur,
          start: acc[acc.length - 1].sec + acc[acc.length - 1].start,
        };
        acc.push(newCur);
      }
      return acc;
    }, []);
    return {
      duration,
      lyric_full: lyricsCurrent,
    };
  }, [data?.note.context.lyric]);

  const togglePlay = () => {
    if (!audio) return;
    if (audio.paused) {
      audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const handleVolumeChange = (val: number) => {
    if (!audio) return;
    audio.volume = val / 100;
    setVolume(val);
  };
  const handleSeek = (val) => {
    setProgress(Number(val));
  };

  const speedUp = () => {
    const val = progress + 5;
    audio.currentTime = val;
    setProgress(val);
    setIsSeeking(false);
  };

  const handleSeekStart = () => {
    setIsSeeking(true);
  };

  const handleSeekEnd = (val) => {
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
  }, [isSeeking, audioRef.current]);

  function debounce(fn: Function, delay = 500) {
    let timer: NodeJS.Timeout;
    return function (...args: any[]) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  const handleClick = (name: string) => {
    if (!isAuthenticated) {
      toast("Please Login");
      return;
    }

    if (name === "like") setLiked(true);
    if (name === "dislike") setLiked(false);
    if (name === "bookmark") setBookmarked(true);
    if (name === "disbookmark") setBookmarked(false);

    handleProtectedClick(name);
  };

  const handleProtectedClick = useCallback(
    debounce(async (name: string) => {
      try {
        await mutation.mutateAsync({
          corpus_unique_id: uuid,
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
    }, 500),
    [uuid, mutation]
  );

  useEffect(() => {
    if (progress >= lyrics.duration) {
      setIsPlaying(false);
      setProgress(0);
    }
  }, [progress, lyrics.duration]);

  // console.log("current:", audio?.currentTime, progress, lyrics.duration);
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="p-6 space-y-8 flex my-8 overflow-y-scroll shadow-md min-h-[80vh]">
        <div className="flex justify-between text-gray-600 dark:text-gray-400 mb-2">
          <div className="flex cursor-pointer" onClick={() => router.push("/")}>
            <ChevronLeft />
            <span className="pl-2">Go Back</span>
          </div>
          {!isLoading ? (
            <div className="text-sm">
              {Number(corpusStats?.stats.views).toLocaleString()} listens
            </div>
          ) : null}
        </div>
        {isLoading ? (
          <div>Loading...</div>
        ) : (
          <div className="flex flex-row flex-wrap">
            <div className="lg:flex-[1] lg:-ml-10 lg:justify-items-center flex-[2] mx-auto">
              <div className="lg:w-56 lg:h-56 overflow-hidden rounded-lg w-30 h-30 mx-auto">
                <Image
                  src="/album_cover.png"
                  alt="cover"
                  width={500}
                  height={500}
                  className={`rounded-full transition-all duration-700 ${
                    isPlaying ? "animate-spin" : ""
                  }`}
                  style={{ animationDuration: "10s" }}
                />
              </div>
              <AudioVisualizer isPlaying={isPlaying} />
              <Slider
                value={[progress]}
                max={lyrics.duration}
                step={1}
                className="w-[80%] mx-auto"
                onValueChange={handleSeek}
                onValueCommit={(val) => handleSeekEnd(val[0])}
                onPointerDown={handleSeekStart}
              />
              {loaded ? (
                <div className="flex gap-4 my-4 justify-center">
                  {!isPlaying ? (
                    <Play onClick={togglePlay} />
                  ) : (
                    <Pause onClick={togglePlay} />
                  )}
                  <FastForward onClick={speedUp} />
                  <Popover>
                    <PopoverTrigger asChild>
                      {volume === 0 ? <VolumeX /> : <Volume2 />}
                    </PopoverTrigger>
                    <PopoverContent className="w-40">
                      <div className="flex flex-col items-center space-y-2">
                        <span className="text-sm">Volume: {volume}%</span>
                        <Slider
                          value={[volume]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={(val) => handleVolumeChange(val[0])}
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              ) : (
                <div className="my-4">Loading...</div>
              )}
              <audio
                ref={audioRef}
                controls
                src={data?.note.context.audio}
                hidden
                preload="auto"
                onLoadedMetadata={() => {
                  console.log("监听 loadedmetadata");
                  setLoaded(true);
                }}
              />
            </div>
            <div className="lg:flex-[2] text-white">
              <div className="flex justify-between">
                <div className="text-2xl font-bold">
                  {data?.note.context.song_name}
                </div>
                <div className="flex gap-4">
                  {isAuthenticated &&
                  (liked || corpusStats?.user_status?.is_liked) ? (
                    <Heart
                      className="cursor-pointer text-red-400 fill-red-400"
                      onClick={() => handleClick("dislike")}
                    />
                  ) : (
                    <Heart
                      className="cursor-pointer"
                      onClick={() => handleClick("like")}
                    />
                  )}
                  {isAuthenticated &&
                  (corpusStats?.user_status?.is_bookmarked || bookmarked) ? (
                    <Star
                      className="cursor-pointer text-yellow-400 fill-yellow-400"
                      onClick={() => handleClick("disbookmark")}
                    />
                  ) : (
                    <Star
                      className="cursor-pointer"
                      onClick={() => handleClick("bookmark")}
                    />
                  )}
                  <a
                    href={`https://card.app.aidimsum.com//?uuid=${uuid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e: any) => {
                      const url = e.currentTarget.href;
                      navigator.clipboard.writeText(url).then(() => {
                        toast("Link copied.");
                      });
                    }}
                  >
                    <CircleArrowOutUpRight className="cursor-pointer" />
                  </a>
                </div>
              </div>
              <div className="my-4">
                <p>
                  词：
                  {data?.note.context.lyricist}
                </p>
                <p>
                  曲：
                  {data?.note.context.composer}
                </p>
              </div>
              <Lyrics
                data={data}
                lyric={lyrics}
                progress={progress}
                handleSeekEnd={handleSeekEnd}
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default YueSong;
