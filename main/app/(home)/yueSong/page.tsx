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
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AudioVisualizer from "./_components/audio-visualizer";
import { Slider } from "@/components/ui/slider2";
import {
  corpusInteractApi,
  IStats,
  IUpdateInteractProps,
} from "@/lib/api/corpus-interact";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SearchResult } from "@/lib/api/search";
import Lyrics from "./_components/lyrics";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { toast } from "sonner";

function YueSong() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const yueSongDetails = sessionStorage.getItem("yueSongDetails");
  const data: SearchResult = JSON.parse(yueSongDetails);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audio = audioRef.current;
  const [loaded, setLoaded] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [progress, setProgress] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const queryClient = useQueryClient();

  const { data: corpusStats, isLoading } = useQuery<IStats>({
    queryKey: ["corpus-stats", data.unique_id],
    queryFn: async () => {
      const res = await corpusInteractApi.getStats(data.unique_id);
      return res;
    },
  });

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
      queryClient.invalidateQueries({
        queryKey: ["corpus-stats", data.unique_id],
      });
    },
  });
  const lyrics = useMemo(() => {
    const lyricsOriginal = data.note.context.lyric;
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
  }, [data.note.context.lyric]);

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
    let interval: NodeJS.Timeout | null = null;

    if (!isSeeking && audio && audio.duration > 0) {
      interval = setInterval(() => {
        setProgress(audio.currentTime);
      }, 500);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSeeking, audio]);

  function debounce(fn: Function, delay = 500) {
    let timer: NodeJS.Timeout;
    return function (...args: any[]) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  const handleProtectedClick = useCallback(
    debounce((name: string) => {
      mutation.mutate({
        corpus_unique_id: data.unique_id,
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
    }, 500),
    []
  );

  const handleClick = (name: string) => {
    isAuthenticated ? handleProtectedClick(name) : toast("Please Login");
  };

  // useEffect(() => {
  //   console.log("1:", audio);
  //   if (!audio) return;

  //   const handleLoaded = () => {
  //     setLoaded(true);
  //     console.log("音频元数据已加载");
  //   };
  //   audio.addEventListener("loadedmetadata", handleLoaded);
  //   audio.load();

  //   return () => {
  //     audio.removeEventListener("loadedmetadata", handleLoaded);
  //   };
  // }, [audio]);

  useEffect(() => {
    if (progress >= lyrics.duration) {
      setIsPlaying(false);
      setProgress(0);
    }
  }, [progress, lyrics.duration]);

  // console.log("current:", audio?.currentTime, progress, lyrics.duration);
  return (
    <Card className="container mx-10 p-6 space-y-8 flex my-8 overflow-y-scroll shadow-md ">
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
      <div className="flex flex-row flex-wrap">
        <div className="lg:flex-[1] justify-items-center -ml-10 flex-[2]">
          <div className="lg:w-56 lg:h-56 overflow-hidden rounded-lg w-30 h-30">
            <Image
              src="/album_cover.png"
              alt="cover"
              width={500}
              height={500}
              className={`rounded-full transition-all duration-700 ${
                isPlaying ? "animate-spin" : ""
              }`}
            />
          </div>
          <AudioVisualizer isPlaying={isPlaying} />
          <Slider
            value={[progress]}
            max={lyrics.duration}
            step={1}
            className="w-[60%]"
            onValueChange={handleSeek}
            onValueCommit={(val) => handleSeekEnd(val[0])}
            onPointerDown={handleSeekStart}
          />
          {loaded ? (
            <div className="flex gap-4 my-4">
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
            src={data.note.context.audio}
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
              {data.note.context.song_name}
            </div>
            <div className="flex gap-4">
              {!isAuthenticated || !corpusStats?.user_status?.is_liked ? (
                <Heart
                  className="cursor-pointer"
                  onClick={() => handleClick("like")}
                />
              ) : (
                <Heart
                  className="cursor-pointer text-red-400 fill-red-400"
                  onClick={() => handleClick("dislike")}
                />
              )}
              {!isAuthenticated || !corpusStats?.user_status?.is_bookmarked ? (
                <Star
                  className="cursor-pointer"
                  onClick={() => handleClick("bookmark")}
                />
              ) : (
                <Star
                  className="cursor-pointer text-yellow-400 fill-yellow-400"
                  onClick={() => handleClick("disbookmark")}
                />
              )}
              <a
                href={`https://card.app.aidimsum.com//?uuid=${data.unique_id}`}
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
              {/* {data.note.context.lyric_author} */}
            </p>
            <p>
              曲：
              {/* {data.note.context.tune_author} */}
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
    </Card>
  );
}

export default YueSong;
