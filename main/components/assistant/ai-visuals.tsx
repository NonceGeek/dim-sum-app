"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { useAiPalette } from "@/lib/assistant/ai-palette";
import { cn } from "@/lib/utils";

export type GlowState = "off" | "idle" | "focus" | "active";

// 各状态下边框与外发光的强度、旋转速度
const GLOW_LEVELS: Record<Exclude<GlowState, "off">, { border: number; glow: number; spin: string }> = {
  idle: { border: 0.35, glow: 0.12, spin: "10s" },
  focus: { border: 0.85, glow: 0.3, spin: "6s" },
  active: { border: 1, glow: 0.5, spin: "2.4s" },
};

/** AI 彩色旋转边框：空闲很淡、聚焦变亮、生成中加速流动。 */
export function AiGlowFrame({
  state,
  className,
  children,
}: {
  state: GlowState;
  className?: string;
  children: React.ReactNode;
}) {
  const { conic } = useAiPalette();
  const level = state === "off" ? null : GLOW_LEVELS[state];
  return (
    <div className={cn("relative rounded-3xl", className)}>
      <div
        aria-hidden
        className="ai-spin pointer-events-none absolute -inset-[1.5px] rounded-[inherit] transition-opacity duration-500"
        style={{ background: conic, opacity: level?.border ?? 0, animationDuration: level?.spin }}
      />
      <div
        aria-hidden
        className="ai-spin pointer-events-none absolute -inset-1 rounded-[inherit] blur-xl transition-opacity duration-500"
        style={{ background: conic, opacity: level?.glow ?? 0, animationDuration: level?.spin }}
      />
      <div className="relative rounded-[inherit] bg-background">{children}</div>
    </div>
  );
}

/** 渐变色星星；active 时缓慢旋转并呼吸，表示正在生成。 */
export function AiSparkle({ active = false, className }: { active?: boolean; className?: string }) {
  const { colors } = useAiPalette();
  const gradientId = `ai-sparkle-${useId().replace(/:/g, "")}`;
  return (
    <motion.span
      className={cn("inline-flex", className)}
      animate={active ? { rotate: [0, 20, -12, 0], scale: [1, 1.12, 0.96, 1] } : { rotate: 0, scale: 1 }}
      transition={active ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
    >
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            {colors.map((color, index) => (
              <stop key={color} offset={`${(index / (colors.length - 1)) * 100}%`} stopColor={color} />
            ))}
          </linearGradient>
        </defs>
      </svg>
      <Sparkles className="size-full" stroke={`url(#${gradientId})`} />
    </motion.span>
  );
}

/** 流光文字，用于“思考中”“正在查资料”。 */
export function AiShimmerText({ children, className }: { children: React.ReactNode; className?: string }) {
  const { colors } = useAiPalette();
  return (
    <span
      className={cn("ai-shimmer", className)}
      style={{
        backgroundImage: `linear-gradient(90deg, var(--muted-foreground) 0%, ${colors.join(", ")}, var(--muted-foreground) 100%)`,
      }}
    >
      {children}
    </span>
  );
}
