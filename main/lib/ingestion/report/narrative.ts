import { createHash } from "node:crypto";
import { buildDigest } from "./digest";
import type { ReportV1 } from "./types";
import { type Narrative, type NarrativeSection, NARRATIVE_SECTIONS, validateNarrative } from "./validate";

export const NARRATIVE_PROMPT_VERSION = "report-narrative-v3";
const DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
/** 与入库 Agent 相同的模型（CORPUS_AGENT_MODEL） */
const DEFAULT_MODEL = "deepseek-v4.1-flash";
const TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 3;

const SYSTEM = `你是语料入库报告的撰写人。读者是语料运营人员，想知道这批数据入库了什么、和原始上传数据相比改了什么、哪些地方 AI 没把握由人确认、还有什么需要关注。

你会收到一份 JSON 材料（系统记录整理而成）。请输出一个 JSON 对象，键为 ${NARRATIVE_SECTIONS.join("、")}，值为该章的中文导读（Markdown 段落或列表）：
- overview：三到六句总体结论：这批是什么、做了什么、最需要关注什么。
- files：原始文件的处理思路，特别是被忽略、只作参考、有丢弃或未覆盖部分的文件及原因。
- organization：语料集、新建分类与 tag、音频切分方式及原因。
- changes：按问题类型归纳变动（如"主要是简转繁与少量标点"），不要逐条罗列规则类变动。
- attention：概括 attention_changes：存疑集中在哪类问题、为什么存疑、人最终怎么定。逐条清单由系统列出，不要逐条复述。
- decisions：把人工决策串成时间线，说明每个决定影响了什么。
- issues：概括 open_issues 并给出处理建议。逐条清单由系统列出，不要逐条复述。

硬性规则：
1. 数量优先写 {{key}}，key 必须是材料 numbers 中已有的键，例如 {{inserted}}、{{kind.s2hk}}、{{f-1.records}}。numbers 里没有的数量，只能照抄材料原文的写法（如说明里写的"切成 4 段/首"），数字和单位都要一致；不要自己计算或推算数量。用汉字写数量（如"六处"）也同样检查。粤拼 soeng1、序号 第3首、格式 16-bit 这类带数字的词也必须与材料逐字一致。
2. 提到具体文件、变动、决策、问题、提案时写编号并加方括号，如 [f-1]、[c-0012]、[q-2]、[i-3]、[p-1]；只能用材料中出现过的编号。文件名本身不要写，用 [f-n] 代替。
3. 不写标题、不写表格；表格和清单由系统另行插入，正文里不要提"清单由系统列出"之类的话。
4. 读者不看材料：不要写材料的字段名或取值（如 origin=rule、open_issues、ai_flagged_human_confirmed），用中文说清楚意思。
5. 只输出这个 JSON 对象，不要输出其他文字。
6. 只依据材料，不推测材料中没有的事实；材料没有说明的原因就写"未说明"。某章没有内容时写"无"。`;

export type NarrativeAttempt = {
  ok: boolean;
  errors: string[];
  ms: number;
  usage?: unknown;
  error?: string;
};

export type NarrativeResult = {
  /** 部分章节未通过校验时，这些章节为空字符串；全部未通过为 null */
  narrative: Narrative | null;
  meta: {
    model: string;
    promptVersion: string;
    digestHash: string;
    attempts: NarrativeAttempt[];
    /** 最终未通过校验、被省略的章节 */
    dropped: NarrativeSection[];
  };
};

type Fetch = typeof fetch;

function config() {
  return {
    // 默认与入库 Agent 共用百炼北京地域的 key 与地址（DeepSeek 模型在该地域）
    apiKey:
      process.env.INGESTION_REPORT_LLM_API_KEY ||
      process.env.DASH_SCOPE_BJ_API_KEY ||
      process.env.DASHSCOPE_API_KEY ||
      process.env.ALIBABA_CLOUD_DASHSCOPE_API_KEY ||
      "",
    baseUrl: (
      process.env.INGESTION_REPORT_LLM_BASE_URL ||
      process.env.DASH_SCOPE_BJ_BASE_URL ||
      DEFAULT_BASE_URL
    ).replace(/\/+$/, ""),
    model: process.env.INGESTION_REPORT_MODEL || DEFAULT_MODEL,
  };
}

async function chat(
  fetchImpl: Fetch,
  cfg: ReturnType<typeof config>,
  messages: { role: string; content: string }[],
) {
  const response = await fetchImpl(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: 0.3,
      enable_thinking: false,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`LLM 请求失败 ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  const body = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: unknown;
  };
  return { content: body.choices?.[0]?.message?.content ?? "", usage: body.usage };
}

/** 模型可能用 ```json 代码块包住输出，取第一个 { 到最后一个 } */
export function parseJsonObject(content: string): unknown {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(content.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * 写 AI 导读：逐章校验，通过的章节先采用，未通过的把错误反馈给模型只重写这些章节，
 * 最多 MAX_ATTEMPTS 次。仍未通过的章节省略（模板部分照常输出）；一章都没通过返回 null。
 */
export async function writeNarrative(
  report: ReportV1,
  fetchImpl: Fetch = fetch,
): Promise<NarrativeResult> {
  const cfg = config();
  const digest = JSON.stringify(buildDigest(report));
  const meta: NarrativeResult["meta"] = {
    model: cfg.model,
    promptVersion: NARRATIVE_PROMPT_VERSION,
    digestHash: createHash("sha256").update(digest).digest("hex"),
    attempts: [],
    dropped: [...NARRATIVE_SECTIONS],
  };
  if (!cfg.apiKey) {
    meta.attempts.push({ ok: false, errors: [], ms: 0, error: "未配置 LLM API key" });
    return { narrative: null, meta };
  }
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: `材料：\n${digest}` },
  ];
  const accepted: Partial<Narrative> = {};
  let pending: NarrativeSection[] = [...NARRATIVE_SECTIONS];
  for (let attempt = 0; attempt < MAX_ATTEMPTS && pending.length; attempt++) {
    const started = Date.now();
    try {
      const { content, usage } = await chat(fetchImpl, cfg, messages);
      const parsed = parseJsonObject(content);
      const check = parsed
        ? validateNarrative(report, parsed, digest, pending)
        : { ok: false, errors: ["输出不是 JSON 对象"], failed: pending };
      for (const name of pending)
        if (!check.failed.includes(name))
          accepted[name] = String((parsed as Record<string, unknown>)[name]).trim();
      pending = check.failed;
      meta.attempts.push({ ok: check.ok, errors: check.errors, ms: Date.now() - started, usage });
      if (!pending.length) break;
      messages.push(
        { role: "assistant", content },
        {
          role: "user",
          content: `以下章节没有通过校验，其余章节已采用。请只重写这些章节，输出只含 ${pending.join("、")} 这几个键的 JSON：\n${check.errors.map((e) => `- ${e}`).join("\n")}`,
        },
      );
    } catch (error) {
      meta.attempts.push({
        ok: false,
        errors: [],
        ms: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  meta.dropped = pending;
  if (pending.length === NARRATIVE_SECTIONS.length) return { narrative: null, meta };
  const narrative = Object.fromEntries(NARRATIVE_SECTIONS.map((k) => [k, accepted[k] ?? ""])) as Narrative;
  return { narrative, meta };
}
