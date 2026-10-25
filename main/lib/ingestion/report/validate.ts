import { buildDigest, reportNumbers, reportRefs } from "./digest";
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
/** 未通过校验被省略的章节为空字符串 */
export type Narrative = Record<NarrativeSection, string>;

export const SECTION_LABELS: Record<NarrativeSection, string> = {
  overview: "概览",
  files: "原始文件",
  organization: "组织变化",
  changes: "变动",
  attention: "存疑项",
  decisions: "人工决策",
  issues: "遗留问题",
};

export const PLACEHOLDER = /\{\{\s*([^{}\s]+)\s*\}\}/g;
export const REF = /\[([a-z]\d*-[\d.]+)\]/g;
const BREAK = /[\s，。、；：！？（）「」《》“”‘’,.;:!?()[\]"'`]/;

/** 数量后常见的量词；汉字数字只在后面跟量词或前面是「第」时才当作数字 */
const UNITS = "条处个首段句项次份件类张行页秒位名组批种篇章字轮遍";
const CN = "零一二两三四五六七八九十百千";
const CN_DIGITS: Record<string, number> = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const CN_SCALES: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };
const CN_NUMBER = new RegExp(`(第)?([${CN}]+)(?=\\s*[${UNITS}])|(第)([${CN}]+)`, "g");

function cnToInt(s: string) {
  let total = 0;
  let digit = 0;
  for (const ch of s) {
    if (ch in CN_DIGITS) digit = CN_DIGITS[ch];
    else {
      total += (digit || 1) * CN_SCALES[ch];
      digit = 0;
    }
  }
  return total + digit;
}

/** 按正则替换，同时记下结果中每个字对应原文的位置 */
function replaceMapped(
  src: { text: string; at: number[] },
  pattern: RegExp,
  fn: (...m: string[]) => string,
) {
  let text = "";
  const at: number[] = [];
  let last = 0;
  const keep = (to: number) => {
    text += src.text.slice(last, to);
    at.push(...src.at.slice(last, to));
  };
  for (const m of src.text.matchAll(pattern)) {
    keep(m.index);
    const out = fn(...(m as unknown as string[]));
    text += out;
    for (let i = 0; i < out.length; i++) at.push(src.at[m.index + Math.min(i, m[0].length - 1)]);
    last = m.index + m[0].length;
  }
  keep(src.text.length);
  return { text, at };
}

/**
 * 统一数字写法再比较：汉字数字换成阿拉伯数字（不带「第」的单个「一」「两」除外，「一行白鹭」「两个文件均…」不必追究），
 * 全角数字换成半角，去掉数字与量词之间的空格。导读与材料用同一套规则；at 是每个字在原文中的位置。
 */
export function normalizeNumbers(text: string) {
  let r = { text, at: Array.from({ length: text.length }, (_, i) => i) };
  r = replaceMapped(r, /[０-９]/g, (d) => String(d.charCodeAt(0) - 0xff10));
  r = replaceMapped(r, CN_NUMBER, (all, p1, n1, p2, n2) => {
    const prefix = p1 ?? p2 ?? "";
    const num = n1 ?? n2;
    return (num === "一" || num === "两") && !prefix ? all : `${prefix}${cnToInt(num)}`;
  });
  return replaceMapped(r, new RegExp(`(\\d)\\s+(?=[${UNITS}])`, "g"), (_, d) => d);
}

/**
 * 导读里每个数字连同紧贴它的字母与前后各一个字，如 soeng1、第9首、16-bit、4段。
 * 空白和标点不算紧贴；前面的汉字只算「第」，「切成4段」和「分成4段」都取 4段。
 */
function numberWords({ text, at }: { text: string; at: number[] }, original: string) {
  return [...text.matchAll(/\d+(?:\.\d+)?/g)].map((m) => {
    let start = m.index;
    let end = m.index + m[0].length;
    while (start > 0 && /[A-Za-z]/.test(text[start - 1])) start--;
    while (end < text.length && /[A-Za-z0-9-]/.test(text[end])) end++;
    const prev = text[start - 1];
    if (start > 0 && !BREAK.test(prev) && (prev === "第" || !/[\u3400-\u9fff]/.test(prev))) start--;
    if (end < text.length && !BREAK.test(text[end])) end++;
    // 提示里引用模型写的原文，不是换算后的写法
    const from = at[start];
    const to = at[end - 1] + 1;
    return {
      word: text.slice(start, end),
      value: Number(m[0]),
      context: original.slice(Math.max(0, from - 6), to + 6).replace(/\s+/g, " "),
    };
  });
}

/**
 * 校验一章导读：数量用 {{key}}，或与材料原文的写法一致（数字与量词都相同，汉字数字同样检查）；
 * 粤拼、序号等带数字的词也须与材料一致；引用的编号必须存在；不得自带标题或表格。
 */
function validateSection(
  name: NarrativeSection,
  text: string,
  numbers: Record<string, number>,
  refs: Set<string>,
  material: string,
) {
  const errors: string[] = [];
  for (const [, key] of text.matchAll(PLACEHOLDER))
    if (!(key in numbers)) errors.push(`${name}: 占位符 {{${key}}} 不存在`);
  for (const [, ref] of text.matchAll(REF))
    if (!refs.has(ref)) errors.push(`${name}: 引用 [${ref}] 不存在`);
  // 占位符与编号换成空格，免得把两边的字粘成一个词
  const bare = text.replace(PLACEHOLDER, " ").replace(REF, " ");
  const unsourced = numberWords(normalizeNumbers(bare), bare).filter(
    ({ word }) => /^\d+$/.test(word) || !material.includes(word),
  );
  if (unsourced.length) {
    const hint = (value: number) => {
      const keys = Object.keys(numbers).filter((k) => numbers[k] === value).slice(0, 3);
      return keys.length ? `（可能是 ${keys.map((k) => `{{${k}}}`).join(" 或 ")}）` : "";
    };
    errors.push(
      `${name}: 这些数字在材料里找不到出处：${unsourced
        .slice(0, 3)
        .map((u) => `「${u.context}」${hint(u.value)}`)
        .join("、")}。numbers 里有的数量改成 {{key}}；没有的必须照抄材料原文的写法（数字和单位都一致），不要自己推算或归纳出数量（如"分为三类"）；否则删掉`,
    );
  }
  if (/^\s*#/m.test(text)) errors.push(`${name}: 不要写标题`);
  if (/^\s*\|.*\|\s*$/m.test(text)) errors.push(`${name}: 不要写表格`);
  return errors;
}

/** 逐章校验 LLM 导读；只校验 sections 中列出的章节，未通过的章节列在 failed 中 */
export function validateNarrative(
  report: ReportV1,
  value: unknown,
  material = JSON.stringify(buildDigest(report)),
  sections: readonly NarrativeSection[] = NARRATIVE_SECTIONS,
) {
  const given = (value ?? {}) as Partial<Record<string, unknown>>;
  const numbers = reportNumbers(report);
  const refs = reportRefs(report);
  const normalized = normalizeNumbers(material).text;
  const errors: string[] = [];
  const failed: NarrativeSection[] = [];
  for (const name of sections) {
    const text = given[name];
    const found =
      typeof text === "string" ? validateSection(name, text, numbers, refs, normalized) : [`缺少章节 ${name}`];
    if (found.length) failed.push(name);
    errors.push(...found);
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)], failed };
}
