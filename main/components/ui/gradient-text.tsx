"use client";

import { useRef, useState, useCallback } from "react";
import {
  motion,
  useMotionValue,
  useAnimationFrame,
  useTransform,
} from "motion/react";

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  colors?: string[];
  animationSpeed?: number;
  pauseOnHover?: boolean;
}

export default function GradientText({
  children,
  className = "",
  colors = ["#3193ff", "#007fff", "#5aa8ff"],
  animationSpeed = 8,
  pauseOnHover = false,
}: GradientTextProps) {
  const [isPaused, setIsPaused] = useState(false);
  const progress = useMotionValue(0);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);

  const animationDuration = animationSpeed * 1000;

  useAnimationFrame((time) => {
    if (isPaused) {
      lastTimeRef.current = null;
      return;
    }
    if (lastTimeRef.current === null) {
      lastTimeRef.current = time;
      return;
    }
    const delta = time - lastTimeRef.current;
    lastTimeRef.current = time;
    elapsedRef.current += delta;

    // Yoyo: reverse at end for seamless loop
    const fullCycle = animationDuration * 2;
    const cycleTime = elapsedRef.current % fullCycle;
    if (cycleTime < animationDuration) {
      progress.set((cycleTime / animationDuration) * 100);
    } else {
      progress.set(100 - ((cycleTime - animationDuration) / animationDuration) * 100);
    }
  });

  // Duplicate first color at end for seamless loop
  const gradientColors = [...colors, colors[0]].join(", ");
  const backgroundPosition = useTransform(progress, (p) => `${p}% 50%`);

  const handleMouseEnter = useCallback(() => {
    if (pauseOnHover) setIsPaused(true);
  }, [pauseOnHover]);

  const handleMouseLeave = useCallback(() => {
    if (pauseOnHover) setIsPaused(false);
  }, [pauseOnHover]);

  return (
    <motion.span
      className={`inline-block bg-clip-text text-transparent ${className}`}
      style={{
        backgroundImage: `linear-gradient(to right, ${gradientColors})`,
        backgroundSize: "300% 100%",
        backgroundRepeat: "repeat",
        backgroundPosition,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </motion.span>
  );
}
