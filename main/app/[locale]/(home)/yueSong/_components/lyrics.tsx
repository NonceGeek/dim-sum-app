"use client";

import { useEffect, useRef, useState } from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { SearchResult } from "@/lib/api/search";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

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
    null,
  );
  // const [debugMsg, setDebugMsg] = useState<string>("");

  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isMobile = useIsMobile();

  // 🎯 自动滚动到当前句
  useEffect(() => {
    const currentIndex = lyric_full.findIndex((x, i) => {
      const next = lyric_full[i + 1];
      return progress >= x.start && (!next || progress < next.start);
    });

    if (currentIndex !== -1) {
      lineRefs.current[currentIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [progress, lyric_full]);

  // 🎯 PC 点击空白取消
  useEffect(() => {
    const handler = () => setSelectedIndex(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // =========================
  // 📱 Mobile 长按
  // =========================
  const handleTouchStart = (index: number) => {
    const timer = setTimeout(() => {
      setSelectedIndex(index);
    }, 500);

    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) clearTimeout(longPressTimer);
  };

  // =========================
  // 🖥 PC 选中文字（关键修复）
  // =========================
  const handleMouseUp = (index: number) => {
    if (isMobile) return;

    // ⚠️ 延迟确保 selection 已稳定
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();

      // console.log("handleMouseUp", {
      //   index,
      //   text,
      //   lineText: lyric_full[index].data,
      // });

      if (!text) {
        // console.log("No text selected, setting null");
        setSelectedIndex(null);
        return;
      }

      const lineText = lyric_full[index].data;

      // 检查选中的文字是否包含当前行的中文部分
      // 移除换行符和粤拼，只检查中文
      const cleanText = text.split("\n")[0].trim();

      if (lineText.includes(cleanText) || cleanText.includes(lineText)) {
        // console.log("Text matches, setting index", index);
        setSelectedIndex(index);
        // 清除文字选择，避免干扰
        selection?.removeAllRanges();
      } else {
        // console.log("Text doesn't match, setting null");
        setSelectedIndex(null);
      }
    }, 10);
  };

  // =========================
  // 🎯 分享
  // =========================
  const handleShare = (e: React.MouseEvent | React.TouchEvent) => {
    // setDebugMsg("handleShare clicked, selectedIndex: " + selectedIndex);
    e.stopPropagation();
    e.preventDefault();

    if (selectedIndex === null) {
      // setDebugMsg("selectedIndex is null, returning");
      return;
    }

    const line = lyric_full[selectedIndex];

    const shareUrl = `https://card.app.aidimsum.com/?data=${encodeURIComponent(
      data.note.context.song_name,
    )}&author=${encodeURIComponent(
      data.note.context.author,
    )}&lyric=${encodeURIComponent(line.data)}&pron=${encodeURIComponent(
      line.pron,
    )}&contri=${data.note.contributor}`;

    // setDebugMsg("shareUrl created");

    // 移动端备用方案：直接打开链接，不依赖 clipboard
    if (navigator.clipboard && window.isSecureContext) {
      // setDebugMsg("Using clipboard API");
      navigator.clipboard.writeText(shareUrl).then(() => {
        // setDebugMsg("Clipboard successful, opening window");
        toast("Link copied.");
        window.open(shareUrl);
        setSelectedIndex(null);
      }).catch((err) => {
        // setDebugMsg("Clipboard error: " + JSON.stringify(err) + ", opening directly");
        toast("Opening link...");
        window.open(shareUrl);
        setSelectedIndex(null);
      });
    } else {
      // setDebugMsg("Clipboard not available, opening directly");
      toast("Opening link...");
      window.open(shareUrl);
      setSelectedIndex(null);
    }
  };

  return (
    <TooltipProvider>
      <div className="relative">
        {/* 调试信息 */}
        {/* {debugMsg && (
          <div className="fixed top-0 left-0 right-0 bg-red-500 text-white p-2 z-[9999] text-xs">
            {debugMsg}
            <button onClick={() => setDebugMsg("")} className="ml-2 underline">
              Clear
            </button>
          </div>
        )} */}
        <div className="overflow-y-auto h-100">
          {lyric_full.map((x, index) => {
            const beforeTime = x.start;
            const afterTime =
              index + 1 === lyric_full.length
                ? duration
                : lyric_full[index + 1].start;

            const ratio = Math.max(
              0,
              Math.min(1, (progress - beforeTime) / (afterTime - beforeTime)),
            );

            const chars = x.data?.split("") || [];
            const yuepingchars = x.pron?.split(" ") || [];

            const highlightCount = Math.round(ratio * chars.length);
            const highlightYuePingCount = Math.round(
              ratio * yuepingchars.length,
            );

            const isSelected = selectedIndex === index;
            // console.log("selectedIndex", selectedIndex, index, isSelected);

            // 🎯 颜色逻辑（只高亮当前句）
            const charsColor = (i: number, highlightCount: number) => {
              if (isSelected) return "var(--ds-color-amber-500)";

              // 未开始 or 已结束
              if (progress < beforeTime || progress >= afterTime) {
                return "var(--foreground)";
              }

              // 当前句逐字
              return i < highlightCount
                ? "var(--primary)"
                : "var(--foreground)";
            };

            return (
              <div key={index} className="my-2 p-1">
                {isSelected ? (
                  <Tooltip open={true}>
                    <TooltipTrigger asChild>
                      <div
                        onMouseUp={(e) => {
                          e.stopPropagation();
                          handleMouseUp(index);
                        }}
                        onTouchStart={() => handleTouchStart(index)}
                        onTouchEnd={handleTouchEnd}
                      >
                        {/* 中文 */}
                        <p
                          onClick={() => handleSeekEnd(x.start)}
                          className="cursor-pointer"
                        >
                          {chars.map((char, i) => (
                            <span
                              key={i}
                              style={{
                                color: charsColor(i, highlightCount),
                              }}
                            >
                              {char}
                            </span>
                          ))}
                        </p>

                        {/* 粤拼 */}
                        <p
                          onClick={() => handleSeekEnd(x.start)}
                          className="cursor-pointer"
                        >
                          {yuepingchars.map((char, i) => (
                            <span
                              key={i}
                              style={{
                                color: charsColor(i, highlightCount),
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
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        onClick={handleShare}
                        onTouchEnd={(e) => {
                          e.stopPropagation();
                          (handleShare as any)(e);
                        }}
                        className="bg-neutral-200 text-black border-0 hover:bg-neutral-200 shadow-none"
                      >
                        生成並分享卡片
                      </Button>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <div
                    onMouseUp={(e) => {
                      e.stopPropagation();
                      handleMouseUp(index);
                    }}
                    onTouchStart={() => handleTouchStart(index)}
                    onTouchEnd={handleTouchEnd}
                  >
                    {/* 中文 */}
                    <p
                      onClick={() => handleSeekEnd(x.start)}
                      className="cursor-pointer"
                    >
                      {chars.map((char, i) => (
                        <span
                          key={i}
                          style={{
                            color: charsColor(i, highlightCount),
                          }}
                        >
                          {char}
                        </span>
                      ))}
                    </p>

                    {/* 粤拼 */}
                    <p
                      onClick={() => handleSeekEnd(x.start)}
                      className="cursor-pointer"
                    >
                      {yuepingchars.map((char, i) => (
                        <span
                          key={i}
                          style={{
                            color: charsColor(i, highlightCount),
                            transition: "color 0.3s linear",
                          }}
                        >
                          {char + " "}
                        </span>
                      ))}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
