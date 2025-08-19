"use client";

import { Card } from "@/components/ui/card";
import {
  ChevronLeft,
  CircleArrowOutUpRight,
  Save,
  HeartPlus,
  Play,
  FastForward,
  VolumeX,
  Pause,
  Volume2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import AudioVisualizer from "./_components/audio-visualizer";
import { Slider } from "@/components/ui/slider";
import Lyrics from "./_components/lyrics";

function YueSong() {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement>(null);
  const audio = audioRef.current;
  const [loaded, setLoaded] = useState(false);
  console.log(loaded);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  const data = {
    lyric: "今天我, 寒夜里看雪飘过",
    song_info: {
      context: {
        title: "海阔天空",
        artist: "Beyond",
        lyric_author: "xxx",
        tune_author: "yyy",
        album: "乐与怒",
        description: "Beyond 乐队的代表作，传递自由精神。",
        duration: 258,
      },
      contributor: "0x05",
    },
    listener_num: 10,
    liked_num: 10,
    collected_num: 20,
    yue_pin: "gam1 tin1 ngo5, hon4 je6 leoi5 hon3 syut3 piu1 gwo3",
    audio: "/test.mp3",
    lyric_full: [
      {
        yue_pin: "gam1 tin1 ngo5, hon4 je6 leoi5 hon3 syut3 piu1 gwo3",
        lyric: "今天我, 寒夜里看雪飘过",
        time: 5,
      },
      {
        yue_pin: "xx yy zz, dd tt yy uu ii ii oo",
        lyric: "123, 456789",
        time: 10,
      },
      {
        yue_pin: "gam1 tin1 ngo5, hon4 je6 leoi5 hon3 syut3 piu1 gwo3",
        lyric: "今天我, 寒夜里看雪飘过",
        time: 15,
      },
      {
        yue_pin: "xx yy zz, dd tt yy uu ii ii oo",
        lyric: "123, 456789",
        time: 20,
      },
      {
        yue_pin: "gam1 tin1 ngo5, hon4 je6 leoi5 hon3 syut3 piu1 gwo3",
        lyric: "今天我, 寒夜里看雪飘过",
        time: 25,
      },
      {
        yue_pin: "xx yy zz, dd tt yy uu ii ii oo",
        lyric: "123, 456789",
        time: 30,
      },
      {
        yue_pin: "gam1 tin1 ngo5, hon4 je6 leoi5 hon3 syut3 piu1 gwo3",
        lyric: "今天我, 寒夜里看雪飘过",
        time: 35,
      },
      {
        yue_pin: "xx yy zz, dd tt yy uu ii ii oo",
        lyric: "123, 456789",
        time: 40,
      },
      {
        yue_pin: "gam1 tin1 ngo5, hon4 je6 leoi5 hon3 syut3 piu1 gwo3",
        lyric: "今天我, 寒夜里看雪飘过",
        time: 45,
      },
      {
        yue_pin: "xx yy zz, dd tt yy uu ii ii oo",
        lyric: "123, 456789",
        time: 50,
      },
      {
        yue_pin: "gam1 tin1 ngo5, hon4 je6 leoi5 hon3 syut3 piu1 gwo3",
        lyric: "今天我, 寒夜里看雪飘过",
        time: 55,
      },
      {
        yue_pin: "xx yy zz, dd tt yy uu ii ii oo",
        lyric: "123, 456789",
        time: 60,
      },
      {
        yue_pin: "gam1 tin1 ngo5, hon4 je6 leoi5 hon3 syut3 piu1 gwo3",
        lyric: "今天我, 寒夜里看雪飘过",
        time: 65,
      },
      {
        yue_pin: "xx yy zz, dd tt yy uu ii ii oo",
        lyric: "123, 456789",
        time: 70,
      },
    ],
  };

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
  const toggleMute = () => {
    if (!audio) return;
    audio.muted = !audio.muted;
    setIsMuted(audio.muted);
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

  console.log("current:", audio?.currentTime, progress);
  return (
    <Card className="container mx-10 p-6 space-y-8 flex my-8 overflow-y-scroll shadow-md ">
      <div className="flex justify-between text-gray-600 dark:text-gray-400 mb-2">
        <div className="flex cursor-pointer" onClick={() => router.back()}>
          <ChevronLeft />
          <span className="pl-2">Go Back</span>
        </div>
        <div className="text-sm">
          {Number(data.listener_num + 1).toLocaleString()} listens
        </div>
      </div>
      <div className="flex flex-row flex-wrap">
        <div className="flex-[1] justify-items-center -ml-10">
          <div className="lg:w-56 lg:h-56 overflow-hidden rounded-lg w-34 h-34">
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
            max={data.song_info.context.duration}
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
              {isMuted ? (
                <VolumeX onClick={toggleMute} />
              ) : (
                <Volume2 onClick={toggleMute} />
              )}
            </div>
          ) : (
            <div className="my-4">Loading...</div>
          )}
          <audio
            ref={audioRef}
            controls
            src={data.audio}
            hidden
            preload="auto"
            onLoadedMetadata={() => {
              console.log("监听 loadedmetadata");
              setLoaded(true);
            }}
          />
        </div>
        <div className="flex-[2] text-white">
          <div className="flex justify-between">
            <div className="text-2xl font-bold">
              {data.song_info.context.title}
            </div>
            <div className="flex gap-4">
              <HeartPlus />
              <Save />
              <CircleArrowOutUpRight />
            </div>
          </div>
          <div className="my-4">
            <p>词：{data.song_info.context.lyric_author}</p>
            <p>曲：{data.song_info.context.tune_author}</p>
          </div>
          <Lyrics
            data={data}
            progress={progress}
            handleSeekEnd={handleSeekEnd}
          />
        </div>
      </div>
    </Card>
  );
}

export default YueSong;
