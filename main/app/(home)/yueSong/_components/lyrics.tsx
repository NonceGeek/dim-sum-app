import { useRef } from "react";

export default function Lyrics({ data, progress, handleSeekEnd }) {
  return (
    <div className="overflow-y-auto h-100">
      {data.lyric_full.map((x, index) => {
        const lyricRefs = useRef<(HTMLDivElement | null)[]>([]);
        const beforeTime = x.time;
        const afterTime =
          index + 1 === data.lyric_full.length
            ? data.song_info.context.duration
            : data.lyric_full[index + 1].time;
        const isHighlighted = progress >= beforeTime && progress < afterTime;

        const ratio = Math.max(
          0,
          Math.min(1, (progress - beforeTime) / (afterTime - beforeTime))
        );

        const chars = x.lyric.split("");
        const yuepingchars = x.yue_pin.split(" ");
        const highlightCount = Math.floor(ratio * chars.length);
        const hightlightYuePingCount = Math.floor(ratio * yuepingchars.length);
        const pastTime = progress >= afterTime;

        if (isHighlighted) {
          // 在歌词变化的时候滚动
          setTimeout(() => {
            lyricRefs.current[index]?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }, 0);
        }

        return (
          <div
            key={index}
            ref={(el) => {
              lyricRefs.current[index] = el;
            }}
            className={`my-4`}
          >
            <p
              onClick={(e) => handleSeekEnd(x.time)}
              className="cursor-pointer"
            >
              {chars.map((char, i) => (
                <span
                  key={i}
                  style={{
                    color: pastTime
                      ? "white"
                      : i < highlightCount
                      ? "var(--primary)"
                      : "white",
                    transition: "color 0.3s linear",
                  }}
                >
                  {char}
                </span>
              ))}
            </p>
            <p
              onClick={(e) => handleSeekEnd(x.time)}
              className="cursor-pointer"
            >
              {yuepingchars.map((char, i) => (
                <span
                  key={i}
                  style={{
                    color: pastTime
                      ? "white"
                      : i < hightlightYuePingCount
                      ? "var(--primary)"
                      : "white",
                    transition: "color 0.3s linear",
                  }}
                >
                  {char + " "}
                </span>
              ))}
            </p>
            {/* <p>
              {x.time}-{x.lyric}
            </p> */}
            {/* <p>{x.yue_pin}</p> */}
          </div>
        );
      })}
    </div>
  );
}
