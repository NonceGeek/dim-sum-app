"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import type { StoreApp } from "@/lib/app-store/model";
import { appCopy } from "./copy";

const palettes = {
  learning: {
    start: "#e8f1ff",
    end: "#c9ddfa",
    ink: "#234d82",
    accent: "#739dd7",
  },
  ai: { start: "#f0eaff", end: "#d9cff5", ink: "#594080", accent: "#a08acb" },
  game: { start: "#fff0e4", end: "#f7d6bb", ink: "#88502c", accent: "#d89b72" },
  data: { start: "#e3f3f5", end: "#bfdfe5", ink: "#28616b", accent: "#78b0bd" },
  community: {
    start: "#e7f4ed",
    end: "#c7e4d5",
    ink: "#35634e",
    accent: "#87b59c",
  },
  other: {
    start: "#eff0f6",
    end: "#d8dce9",
    ink: "#505c78",
    accent: "#9ba7c2",
  },
};

/** Stable vector artwork: no network request, stored image, animation or random layout. */
export function AppArtwork({
  app,
  className = "",
}: {
  app: StoreApp;
  className?: string;
}) {
  const t = appCopy(useLocale());
  const [coverFailed, setCoverFailed] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);
  useEffect(() => setCoverFailed(false), [app.coverUrl]);
  useEffect(() => setIconFailed(false), [app.iconUrl]);
  const p = palettes[app.category] ?? palettes.other;
  const seed = Array.from(app.id || app.name).reduce(
    (v, c) => (v * 31 + c.codePointAt(0)!) >>> 0,
    17,
  );
  const angle = (seed % 9) - 4;
  const x = 62 + (seed % 18);
  return (
    <div
      className={`relative isolate aspect-[16/9] overflow-hidden ${className}`}
      style={{
        background: `linear-gradient(125deg, ${p.start}, ${p.end})`,
        containerType: "inline-size",
      }}
    >
      {(!app.coverUrl || coverFailed) && (
        <>
          <div className="absolute inset-0" aria-hidden="true">
            <svg
              viewBox="0 0 480 270"
              className="h-full w-full"
              preserveAspectRatio="xMidYMid slice"
              fill="none"
            >
              <circle cx={x * 5} cy="48" r="148" fill="white" opacity=".25" />
              <circle
                cx={x * 5}
                cy="48"
                r="110"
                stroke={p.accent}
                strokeWidth="1"
                opacity=".27"
              />
              <circle
                cx="32"
                cy="276"
                r="135"
                stroke={p.accent}
                strokeWidth="30"
                opacity=".14"
              />
              <path
                d="M285 205h116M285 219h77M285 233h95"
                stroke={p.ink}
                strokeWidth="1"
                opacity=".12"
              />
              {[0, 1, 2, 3].map((i) =>
                [0, 1, 2].map((j) => (
                  <circle
                    key={`${i}-${j}`}
                    cx={37 + i * 11}
                    cy={50 + j * 11}
                    r="1.5"
                    fill={p.ink}
                    opacity=".18"
                  />
                )),
              )}
            </svg>
          </div>
          <div
            className="absolute inset-0 flex items-center justify-center pb-2"
            aria-hidden="true"
          >
            {app.iconUrl && !iconFailed ? (
              <div
                className="flex h-[42%] aspect-square items-center justify-center rounded-[24%] border border-white/80 bg-white/75 shadow-[0_12px_32px_-12px_rgba(30,45,75,0.3),inset_0_1px_0_white]"
                style={{ transform: `rotate(${angle}deg)` }}
              >
                <img
                  src={app.iconUrl}
                  alt=""
                  loading="lazy"
                  className="h-[64%] w-[64%] object-contain"
                  onError={() => setIconFailed(true)}
                />
              </div>
            ) : (
              <span
                className="line-clamp-2 max-w-[80%] text-balance text-center font-semibold tracking-tight"
                style={{
                  color: p.ink,
                  fontSize: "clamp(1.25rem, 8cqw, 2.75rem)",
                  lineHeight: 1.3,
                  overflowWrap: "anywhere",
                }}
              >
                {app.name.trim() || t[app.category]}
              </span>
            )}
          </div>
          <div
            className="absolute inset-x-0 bottom-0 flex items-end justify-end px-[6%] pb-[5%]"
            style={{ color: p.ink }}
            aria-hidden="true"
          >
            <span className="shrink-0 text-[8px] font-semibold tracking-[.2em] opacity-55">
              DIMSUM
            </span>
          </div>
        </>
      )}
      {app.coverUrl && !coverFailed && (
        <img
          src={app.coverUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setCoverFailed(true)}
        />
      )}
    </div>
  );
}
