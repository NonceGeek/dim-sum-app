// 小助手的“AI 多彩”配色（蓝紫粉橙，参考 Gemini / Apple Intelligence），
// 只用于输入框光晕、发送按钮、星星与流光文字；首页“问小助手”模式同样使用。
const COLORS = ["#4f8cff", "#a855f7", "#ec4899", "#f97316"] as const;
const GLOW_HSL = "275 85 68";

const AI_PALETTE = {
  colors: COLORS as readonly string[],
  glowHsl: GLOW_HSL,
  /** 线性渐变（按钮、文字） */
  linear: `linear-gradient(135deg, ${COLORS.join(", ")})`,
  /** 首尾相接的锥形渐变（旋转边框） */
  conic: `conic-gradient(from var(--ai-angle), ${[...COLORS, COLORS[0]].join(", ")})`,
};

export function useAiPalette() {
  return AI_PALETTE;
}
