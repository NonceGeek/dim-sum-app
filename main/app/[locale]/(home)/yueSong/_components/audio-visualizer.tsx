"use client";

export default function AudioVisualizer({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div className="flex items-center gap-1 h-10 my-10 justify-center">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className={`w-1 bg-white ${isPlaying ? "animate-wave" : ""}`}
          style={{
            height: isPlaying ? undefined : "40%",
            animationDelay: `${i * 0.1}s`,
            animationDuration: "1s",
          }}
        ></div>
      ))}
    </div>
  );
}
