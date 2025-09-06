"use client";

import { useState } from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip2";
import { Button } from "@/components/ui/button";
import { SearchResult } from "@/lib/api/search";
import { toast } from "sonner";

interface ILyricLine {
  data: string;
  pron: string;
  start: number;
  time: number;
}

interface ILyricsProps {
  data: SearchResult;
  lyric: { lyric_full: ILyricLine[]; duration: number };
  progress: number;
  handleSeekEnd: (time: number) => void;
}

export default function Lyrics({
  data,
  lyric,
  progress,
  handleSeekEnd,
}: ILyricsProps) {
  const { lyric_full, duration } = lyric;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(
    null
  );

  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  const handleTouchStart = (index: number) => {
    const timer = setTimeout(() => {
      handleSelectLine(index); // 触发选中
    }, 500); // 500ms 长按
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) clearTimeout(longPressTimer); // 取消长按
  };

  const handleMouseUp = (index: number) => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      setSelectedIndex(index);
    } else {
      setSelectedIndex(null);
    }
  };

  const handleSelectLine = (index: number) => {
    setSelectedIndex(index === selectedIndex ? null : index);
  };

  const handleShare = () => {
    if (selectedIndex === null) return;
    const line = lyric_full[selectedIndex];
    const shareUrl = `https://card.app.aidimsum.com/?data=${encodeURIComponent(data.note.context.song_name)}&author=${encodeURIComponent(data.note.context.author)}&lyric=${encodeURIComponent(line.data)}&pron=${encodeURIComponent(line.pron)}&contri=${data.note.contributor}`;
    // if (navigator.share) {
    //   navigator.share({
    //     title: "歌词分享",
    //     text: "快来看看这句歌词吧～",
    //     url: shareUrl,
    //   });
    // } else {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        toast("Link copied.");
        window.open(shareUrl);
      });
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        toast("Link copied.");
        window.open(shareUrl);
      } catch (err) {
        toast("Link copied Failed.");
      }
      document.body.removeChild(textarea);
    }
    // }

    setSelectedIndex(null);
  };

  return (
    <TooltipProvider>
      <div className="relative">
        <div className="overflow-y-auto h-100">
          {lyric_full.map((x, index) => {
            const beforeTime = x.start;
            const afterTime =
              index + 1 === lyric_full.length
                ? duration
                : lyric_full[index + 1].start;
            const ratio = Math.max(
              0,
              Math.min(1, (progress - beforeTime) / (afterTime - beforeTime))
            );
            const chars = x.data?.split("") || [];
            const yuepingchars = x.pron?.split(" ") || [];
            const highlightCount = Math.floor(ratio * chars.length);
            const highlightYuePingCount = Math.floor(
              ratio * yuepingchars.length
            );
            const pastTime = progress >= afterTime;

            const isSelected = selectedIndex === index;
            const charsColor = (char, i, highlightCount) => {
              if (isSelected) return "yellow";
              if (progress >= afterTime) return "white";
              return i < highlightCount ? "var(--primary)" : "white";
            };

            return (
              <div key={index} className="my-2 p-1">
                <Tooltip open={selectedIndex === index}>
                  <TooltipTrigger asChild>
                    <div
                      onMouseUp={() => handleMouseUp(index)}
                      onTouchStart={() => handleTouchStart(index)}
                      onTouchEnd={handleTouchEnd}
                    >
                      <p
                        onClick={() => handleSeekEnd(x.start)}
                        className="cursor-pointer"
                      >
                        {chars.map((char, i) => (
                          <span
                            key={i}
                            style={{
                              color: charsColor(char, i, highlightCount),
                            }}
                          >
                            {char}
                          </span>
                        ))}
                      </p>
                      <p
                        onClick={() => handleSeekEnd(x.start)}
                        className="cursor-pointer"
                      >
                        {yuepingchars.map((char, i) => (
                          <span
                            key={i}
                            style={{
                              color: charsColor(char, i, highlightYuePingCount),
                              // color: pastTime
                              //   ? "white"
                              //   : isSelected
                              //     ? "yellow"
                              //     : i < highlightYuePingCount
                              //       ? "var(--primary)"
                              //       : "white",
                              transition: "color 0.3s linear",
                            }}
                          >
                            {char + " "}
                          </span>
                        ))}
                      </p>
                    </div>
                  </TooltipTrigger>

                  <TooltipContent
                    className="bg-neutral-200 p-2 rounded shadow"
                    side={isMobile ? "bottom" : "top"}
                  >
                    <Button
                      onClick={handleShare}
                      className="bg-neutral-200 text-black border-0 hover:bg-neutral-200 shadow-none"
                    >
                      生成並分享卡片
                    </Button>
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
