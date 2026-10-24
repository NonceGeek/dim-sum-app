import { reportNumbers } from "./digest";
import type { ReportChange, ReportV1 } from "./types";
import { type Narrative, PLACEHOLDER, REF } from "./validate";

export const DETAIL_LIMIT = 20;

export const KIND_LABELS: Record<string, string> = {
  s2hk: "简转繁",
  jyutping_generated: "自动注音",
  jyutping_fix: "粤拼修正",
  text_fix: "文字修正",
  punctuation: "标点",
  whitespace: "空白",
  segment_boundary: "切分边界",
  split: "拆分",
  merge: "合并",
  flagged_unchanged: "存疑未改",
  other: "其他",
};

export const ORIGIN_LABELS: Record<string, string> = {
  rule: "规则",
  ai_auto: "AI 自动修正",
  ai_flagged_human_confirmed: "AI 存疑、人工确认",
  human_override: "人工直接修改",
  human_rejected_ai: "人工否决 AI 建议",
  unexplained: "未说明",
};

export const HANDLING_LABELS: Record<string, string> = {
  parsed: "解析",
  split: "切分",
  converted: "转换",
  reference_only: "仅作参考",
  ignored: "未使用",
  unknown: "无记录",
};

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: "已完成",
  CANCELLED: "已取消",
  IN_PROGRESS: "进行中",
  PENDING: "待开始",
};

const label = (map: Record<string, string>, key: string | null | undefined) =>
  (key && map[key]) || key || "—";

/** 表格单元格：去掉换行与竖线 */
const cell = (s: unknown) =>
  String(s ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|") || "—";

/** 行内文本：反引号包住原值，空值显示为（空） */
const quote = (s: string) => (s ? `\`${s.replace(/`/g, "'").replace(/\r?\n/g, " ")}\`` : "（空）");

const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 16).replace("T", " ") + " UTC" : "—");

const size = (bytes: number | undefined) => {
  if (bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
};

/** 锚点的可读写法：input/清单.xlsx#sheet=S&row=12 → 清单.xlsx「S」第 12 行 */
export function describeAnchor(anchor: string) {
  const hash = anchor.indexOf("#");
  const target = hash < 0 ? anchor : anchor.slice(0, hash);
  const file = target.replace(/^input\//, "").replace("!/", " › ");
  if (hash < 0) return file;
  const params = new Map(
    anchor
      .slice(hash + 1)
      .split("&")
      .map((p) => {
        const eq = p.indexOf("=");
        return [p.slice(0, eq), decodeURIComponent(p.slice(eq + 1))] as const;
      }),
  );
  const parts = [file];
  if (params.has("sheet")) parts.push(`「${params.get("sheet")}」`);
  if (params.has("table")) parts.push(`表 ${params.get("table")}`);
  if (params.has("page")) parts.push(`第 ${params.get("page")} 页`);
  if (params.has("row")) parts.push(`第 ${params.get("row")} 行`);
  if (params.has("para")) parts.push(`第 ${params.get("para")} 段`);
  if (params.has("line")) parts.push(`第 ${params.get("line")} 行`);
  if (params.has("col")) parts.push(`${params.get("col")} 列`);
  if (params.has("part")) parts.push(`第 ${params.get("part")} 部分`);
  if (params.has("t")) parts.push(`${params.get("t")!.replace(",", "–")}s`);
  return parts.join(" ");
}

const changeLine = (c: ReportChange) => {
  const where = c.src ? describeAnchor(c.src) : c.segment_id ?? `第 ${c.row} 条`;
  const flags = c.evidence?.flags ? ` · 存疑原因：${String(c.evidence.flags)}` : "";
  const decision = c.decisionId ? `（决策 \`${c.decisionId}\`）` : "";
  const note = c.note ? ` · ${c.note}` : "";
  const value = c.kind === "flagged_unchanged" ? `保留 ${quote(c.after)}` : `${quote(c.before)} → ${quote(c.after)}`;
  return `- \`${c.id}\` ${where} · ${c.facet}：${value}${flags} · ${label(ORIGIN_LABELS, c.origin)}${decision}${note}`;
};

const limited = <T>(items: T[], line: (x: T) => string, rest: string) => {
  if (!items.length) return ["无"];
  const lines = items.slice(0, DETAIL_LIMIT).map(line);
  if (items.length > DETAIL_LIMIT) lines.push(`- 另有 ${items.length - DETAIL_LIMIT} 条，见 Excel《${rest}》`);
  return lines;
};

const table = (head: string[], rows: unknown[][]) =>
  rows.length
    ? [
        `| ${head.join(" | ")} |`,
        `| ${head.map(() => "---").join(" | ")} |`,
        ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`),
      ]
    : ["无"];

/** 把导读中的占位符换成数字、编号换成可读引用 */
export function resolveNarrative(report: ReportV1, text: string) {
  const numbers = reportNumbers(report);
  const files = new Map(report.inputs.map((f) => [f.id, f.path.replace(/^input\//, "")]));
  return text
    .replace(PLACEHOLDER, (_, key: string) => String(numbers[key] ?? "?"))
    .replace(REF, (_, ref: string) => (files.has(ref) ? `\`${files.get(ref)}\`` : `\`${ref}\``));
}

export function renderMarkdown(
  report: ReportV1,
  narrative: Narrative | null,
  opts: { narrativeError?: string } = {},
) {
  const { meta, summary: s, organization: org } = report;
  const t = meta.task;
  const lead = (key: keyof Narrative) =>
    narrative && narrative[key] && narrative[key] !== "无" ? [resolveNarrative(report, narrative[key]), ""] : [];
  const out: string[] = [];
  const push = (...lines: string[]) => out.push(...lines);

  push(
    `# 入库报告：${t.title}（${t.taskNo}）`,
    "",
    `> 生成于 ${day(meta.generatedAt)} · 报告版本 v${meta.version}${meta.kind === "draft" ? "（草稿）" : ""} · 任务状态：${label(STATUS_LABELS, t.status)}`,
    narrative
      ? "> 统计数字与清单来自系统记录；各章开头的导读由 AI 根据系统记录撰写，仅供参考。"
      : `> AI 导读未生成${opts.narrativeError ? `（${opts.narrativeError}）` : ""}，以下内容全部由系统记录整理。`,
    "",
    "## 一、概览",
    "",
    ...lead("overview"),
    `- 目标语料集：\`${org.dataset.name}\`（${org.dataset.ingestionType === "new_dataset" ? `新建${org.dataset.contentAttribute ? `，类型 ${org.dataset.contentAttribute}` : ""}` : "补充已有"}）`,
    `- 负责人：${t.assignee} · 创建人：${t.creator} · 创建于 ${day(t.createdAt)} · 结束于 ${day(t.completedAt ?? t.cancelledAt)}`,
    `- 结果：入库 **${s.inserted}** 条，去重跳过 ${s.skipped} 条${s.unknown ? `，无法确认 ${s.unknown} 条` : ""}；发布媒体 ${s.publishedMedia} 个${s.reusedMedia ? `（复用已有 ${s.reusedMedia} 个）` : ""}`,
    `- 变动：共 ${s.changes} 处${
      s.changes
        ? `，其中${Object.entries(s.changesByOrigin)
            .map(([k, v]) => `${label(ORIGIN_LABELS, k)} ${v}`)
            .join("、")}`
        : ""
    }${s.unexplained ? `；**未说明 ${s.unexplained} 处**` : ""}`,
    `- 人工决策 ${s.decisions} 次；提案 ${s.proposals} 个（驳回 ${s.deniedProposals} 个，执行失败 ${s.failedProposals} 个）`,
    `- 遗留问题 ${s.openIssues} 项`,
    ...(meta.lineage === "none"
      ? ["- 本任务入库时没有来源追溯记录，无法逐条对照原文件；文件处理与变动两章只有系统能确认的部分。"]
      : meta.lineage === "partial"
        ? ["- 部分入库批次没有来源追溯记录，相关语料无法对照原文件。"]
        : []),
    "",
    "## 二、原始文件与处理方式",
    "",
    ...lead("files"),
    ...table(
      ["编号", "文件", "大小", "处理方式", "产出", "对应语料", "丢弃", "未覆盖"],
      report.inputs.map((f) => [
        f.id,
        f.path.replace(/^input\//, ""),
        size(f.size),
        label(HANDLING_LABELS, f.handling),
        f.artifacts.length ? `${f.artifacts.length} 个` : "—",
        f.records,
        f.discarded.length || "—",
        f.uncovered_total || "—",
      ]),
    ),
    "",
  );
  for (const f of report.inputs.filter((f) => f.discarded.length || f.uncovered_total || f.note)) {
    push(`**\`${f.id}\` ${f.path.replace(/^input\//, "")}**`, "");
    if (f.note) push(`- 说明：${f.note}`);
    for (const d of f.discarded.slice(0, DETAIL_LIMIT))
      push(`- 丢弃 ${describeAnchor(d.anchor)}：${d.reason || "未说明原因"}`);
    if (f.discarded.length > DETAIL_LIMIT) push(`- 另有 ${f.discarded.length - DETAIL_LIMIT} 处丢弃，见 Excel《文件处理》`);
    for (const u of f.uncovered.slice(0, DETAIL_LIMIT))
      push(`- 未覆盖 ${describeAnchor(u.anchor)}${u.reason ? `：${u.reason}` : "（未说明）"}`);
    if (f.uncovered_total > DETAIL_LIMIT)
      push(`- 另有 ${f.uncovered_total - Math.min(DETAIL_LIMIT, f.uncovered.length)} 处未覆盖，见 Excel《文件处理》`);
    push("");
  }

  push(
    "## 三、组织变化",
    "",
    ...lead("organization"),
    `- 语料集：\`${org.dataset.name}\`${org.dataset.registered ? `，本任务新建${org.dataset.registered.nickname ? `（${org.dataset.registered.nickname}）` : ""}` : ""}`,
    `- 新建分类：${org.newCategories.length ? org.newCategories.map((c) => `\`${c.slug}\` ${c.name}${c.parent ? `（属于 \`${c.parent}\`）` : ""}`).join("；") : "无"}`,
    `- 新建 tag：${org.newTags.length ? org.newTags.map((g) => `\`${g.slug}\` ${g.name}${g.gloss ? `：${g.gloss}` : ""}`).join("；") : "无"}`,
    "",
    "分类分布：",
    "",
    ...table(["分类", "语料数"], Object.entries(s.byCategory).sort((a, b) => b[1] - a[1])),
    "",
    "tag 分布：",
    "",
    ...table(["tag", "语料数"], Object.entries(s.byTag).sort((a, b) => b[1] - a[1])),
    "",
  );

  const attention = report.changes.filter((c) => c.attention);
  const rest = report.changes.filter((c) => !c.attention);
  const rule = rest.filter((c) => c.origin === "rule");
  const reshaped = rest.filter((c) => c.origin !== "rule" && ["split", "merge"].includes(c.kind));
  const others = rest.filter((c) => !rule.includes(c) && !reshaped.includes(c));
  const byKind = new Map<string, ReportChange[]>();
  for (const c of rule) byKind.set(c.kind, [...(byKind.get(c.kind) ?? []), c]);

  push(
    "## 四、与原始数据相比的变动",
    "",
    ...lead("changes"),
    "### 4.1 规则类变动（整批套用）",
    "",
    ...table(
      ["类型", "条数", "示例"],
      [...byKind].map(([kind, list]) => [
        label(KIND_LABELS, kind),
        list.length,
        `${list[0].before || "（空）"} → ${list[0].after}`,
      ]),
    ),
    "",
    "### 4.2 AI 存疑、人工确认或修正",
    "",
    ...lead("attention"),
    ...(attention.length ? attention.map(changeLine) : ["无"]),
    "",
    "### 4.3 AI 自动修正",
    "",
    ...limited(others.filter((c) => c.origin === "ai_auto"), changeLine, "变动明细"),
    "",
    "### 4.4 人工直接修改",
    "",
    ...limited(others.filter((c) => c.origin === "human_override"), changeLine, "变动明细"),
    "",
    "### 4.5 拆分与合并",
    "",
    ...limited(reshaped, changeLine, "变动明细"),
    "",
    "### 4.6 未说明来由的变动",
    "",
    ...limited(others.filter((c) => c.origin === "unexplained"), changeLine, "变动明细"),
    "",
    "## 五、人工决策记录",
    "",
    ...lead("decisions"),
    ...(report.decisions.length
      ? report.decisions.map((d) => {
          const answer = [...d.selected, ...(d.other ? [`其他：${d.other}`] : [])].join("、") || "（未回答）";
          const affects = d.affects.length
            ? ` · 影响：${d.affects.slice(0, 10).map((a) => `\`${a}\``).join(" ")}${d.affects.length > 10 ? ` 等 ${d.affects.length} 处` : ""}`
            : "";
          return `- \`${d.id}\` **${d.header}**：${d.question} — 回答：${answer}（${day(d.answeredAt ?? d.askedAt)}）${affects}`;
        })
      : ["无"]),
    "",
    "## 六、提案与审批",
    "",
    ...table(
      ["编号", "类型", "摘要", "状态", "审批人", "时间", "备注"],
      report.operations.map((p) => [p.id, p.kind, p.summary, p.status, p.decidedBy, day(p.decidedAt), p.decisionNote]),
    ),
    "",
    "## 七、遗留问题",
    "",
    ...lead("issues"),
    ...(report.openIssues.length
      ? report.openIssues.map(
          (i) => `- \`${i.id}\` ${i.detail}${i.refs.length ? `（${i.refs.slice(0, 10).map((r) => `\`${r}\``).join(" ")}${i.refs.length > 10 ? " 等" : ""}）` : ""}`,
        )
      : ["无"]),
    "",
  );

  if (report.checkpoints.length) {
    push("## 附：处理阶段记录", "");
    for (const c of report.checkpoints.slice(-30)) push(`- ${day(c.at)} ${c.summary.replace(/\r?\n/g, " ")}`);
    push("");
  }
  push(
    "## 附件",
    "",
    `- \`report.v${meta.version}.json\`：完整系统记录`,
    `- \`report.v${meta.version}.xlsx\`：逐条明细（文件处理、入库语料、变动明细、人工决策、提案审批）`,
    ...meta.sourceFiles.map((f) => `- 入库凭据 \`${f.recordsPath}\`（sha256 \`${f.recordsHash.slice(0, 12)}…\`）`),
    "",
  );
  return out.join("\n");
}
