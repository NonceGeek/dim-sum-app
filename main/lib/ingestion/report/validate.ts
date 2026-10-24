import { reportNumbers, reportRefs, requiredRefs } from "./digest";
import type { ReportV1 } from "./types";

/** LLM 写的各章导读，正文不含标题与表格 */
export const NARRATIVE_SECTIONS = [
  "overview",
  "files",
  "organization",
  "changes",
  "attention",
  "decisions",
  "issues",
] as const;

export type NarrativeSection = (typeof NARRATIVE_SECTIONS)[number];
export type Narrative = Record<NarrativeSection, string>;

export const PLACEHOLDER = /\{\{\s*([^{}\s]+)\s*\}\}/g;
export const REF = /\[([a-z]\d*-[\d.]+)\]/g;

/**
 * 校验 LLM 导读：数字只能用 {{key}} 占位符，引用的编号必须存在，
 * 存疑项与遗留问题逐条覆盖（数量过多时除外），不得自带标题或表格。
 */
export function validateNarrative(report: ReportV1, value: unknown) {
  const errors: string[] = [];
  const sections = (value ?? {}) as Partial<Record<string, unknown>>;
  const numbers = reportNumbers(report);
  const refs = reportRefs(report);
  const cited = new Set<string>();

  for (const name of NARRATIVE_SECTIONS) {
    const text = sections[name];
    if (typeof text !== "string") {
      errors.push(`缺少章节 ${name}`);
      continue;
    }
    for (const [, key] of text.matchAll(PLACEHOLDER))
      if (!(key in numbers)) errors.push(`${name}: 占位符 {{${key}}} 不存在`);
    for (const [, ref] of text.matchAll(REF)) {
      if (!refs.has(ref)) errors.push(`${name}: 引用 [${ref}] 不存在`);
      cited.add(ref);
    }
    const bare = text.replace(PLACEHOLDER, "").replace(REF, "");
    if (/[0-9０-９]/.test(bare))
      errors.push(`${name}: 出现了占位符以外的阿拉伯数字，数字一律用 {{key}}`);
    if (/^\s*#/m.test(text)) errors.push(`${name}: 不要写标题`);
    if (/^\s*\|.*\|\s*$/m.test(text)) errors.push(`${name}: 不要写表格`);
  }
  const missing = requiredRefs(report).filter((r) => !cited.has(r));
  if (missing.length)
    errors.push(`以下编号必须逐条在正文中引用：${missing.map((r) => `[${r}]`).join(" ")}`);
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}
