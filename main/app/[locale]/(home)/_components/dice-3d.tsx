"use client";

import { motion } from "motion/react";

const D = 24; // face size in px
const H = D / 2;

const DOT_POS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[27, 27], [73, 73]],
  3: [[27, 27], [50, 50], [73, 73]],
  4: [[27, 27], [73, 27], [27, 73], [73, 73]],
  5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]],
  6: [[27, 21], [73, 21], [27, 50], [73, 50], [27, 79], [73, 79]],
};

// 1 & 4 are red on a traditional Chinese dice; rest are black
const DOT_COLOR: Record<number, string> = {
  1: "#dc2626",
  2: "#1a1008",
  3: "#1a1008",
  4: "#dc2626",
  5: "#1a1008",
  6: "#1a1008",
};

const FACES = [
  { n: 1, t: `rotateY(0deg) translateZ(${H}px)` },
  { n: 6, t: `rotateY(180deg) translateZ(${H}px)` },
  { n: 2, t: `rotateY(-90deg) translateZ(${H}px)` },
  { n: 5, t: `rotateY(90deg) translateZ(${H}px)` },
  { n: 3, t: `rotateX(90deg) translateZ(${H}px)` },
  { n: 4, t: `rotateX(-90deg) translateZ(${H}px)` },
];

export function Dice3D({ rolling }: { rolling: boolean }) {
  return (
    <div style={{ perspective: `${D * 3.5}px`, width: D, height: D }}>
      <motion.div
        style={{ width: D, height: D, transformStyle: "preserve-3d", position: "relative" }}
        animate={rolling ? { rotateX: [0, 360], rotateY: [0, -270] } : { rotateX: 15, rotateY: -20 }}
        transition={rolling ? { duration: 0.7, repeat: Infinity, ease: "linear" } : { duration: 0.35, ease: "easeOut" }}
      >
        {FACES.map(({ n, t }) => (
          <div
            key={n}
            style={{
              position: "absolute", inset: 0, transform: t,
              borderRadius: 4,
              border: "1px solid rgba(160,160,160,0.3)",
              background: "#f2f2f2",
              boxShadow: "inset 0 0 0 0.5px rgba(255,255,255,0.6)",
            }}
          >
            {DOT_POS[n].map(([x, y], i) => (
              <div
                key={i}
                style={{
                  position: "absolute", width: 3.5, height: 3.5, borderRadius: "50%",
                  background: DOT_COLOR[n],
                  left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)",
                  boxShadow: "0 0.5px 1px rgba(0,0,0,0.25)",
                }}
              />
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
