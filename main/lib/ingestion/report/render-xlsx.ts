import * as XLSX from "xlsx";
import { describeAnchor, HANDLING_LABELS, KIND_LABELS, ORIGIN_LABELS } from "./render-md";
import type { ReportV1 } from "./types";

const label = (map: Record<string, string>, key: string | null | undefined) =>
  (key && map[key]) || key || "";

const sources = (s: ReportV1["records"][number]["sources"]) =>
  s
    .map((x) =>
      x.generated
        ? `${x.facet}: 由 ${x.generated.op} 生成`
        : `${x.facet}: ${(x.anchors ?? []).map(describeAnchor).join(" | ") || "未找到"}`,
    )
    .join("\n");

/** 逐条明细：概览、文件处理、入库语料、变动明细、人工决策、提案审批 */
export function renderXlsx(report: ReportV1): Buffer {
  const s = report.summary;
  const t = report.meta.task;
  const book = XLSX.utils.book_new();
  const add = (name: string, rows: Record<string, unknown>[]) =>
    XLSX.utils.book_append_sheet(
      book,
      rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([["无"]]),
      name,
    );

  add("概览", [
    { 项目: "任务", 值: `${t.title}（${t.taskNo}）` },
    { 项目: "目标语料集", 值: t.targetDatasetName },
    { 项目: "任务状态", 值: t.status },
    { 项目: "报告版本", 值: `v${report.meta.version}${report.meta.kind === "draft" ? "（草稿）" : ""}` },
    { 项目: "生成时间", 值: report.meta.generatedAt },
    { 项目: "来源追溯", 值: report.meta.lineage },
    { 项目: "原始文件", 值: s.inputFiles },
    { 项目: "入库", 值: s.inserted },
    { 项目: "去重跳过", 值: s.skipped },
    { 项目: "无法确认", 值: s.unknown },
    { 项目: "发布媒体", 值: s.publishedMedia },
    { 项目: "变动", 值: s.changes },
    ...Object.entries(s.changesByOrigin).map(([k, v]) => ({ 项目: `变动 · ${label(ORIGIN_LABELS, k)}`, 值: v })),
    ...Object.entries(s.changesByKind).map(([k, v]) => ({ 项目: `变动 · ${label(KIND_LABELS, k)}`, 值: v })),
    { 项目: "人工决策", 值: s.decisions },
    { 项目: "提案", 值: s.proposals },
    { 项目: "遗留问题", 值: s.openIssues },
  ]);

  add(
    "文件处理",
    report.inputs.flatMap((f) => [
      {
        编号: f.id,
        文件: f.path,
        大小: f.size ?? "",
        处理方式: label(HANDLING_LABELS, f.handling),
        操作: f.ops.join(", "),
        产出: f.artifacts.join("\n"),
        对应语料: f.records,
        位置: "",
        类别: "",
        原因: f.note,
      },
      ...f.discarded.map((d) => ({
        编号: f.id,
        文件: f.path,
        位置: describeAnchor(d.anchor),
        类别: "丢弃",
        原因: d.reason,
      })),
      ...f.uncovered.map((u) => ({
        编号: f.id,
        文件: f.path,
        位置: describeAnchor(u.anchor),
        类别: "未覆盖",
        原因: u.reason ?? "未说明",
      })),
    ]),
  );

  add(
    "入库语料",
    report.records.map((r) => ({
      编号: r.id,
      状态: { inserted: "已入库", skipped: "去重跳过", unknown: "无法确认" }[r.status],
      语料ID: r.corpusId ?? r.existingId ?? "",
      行: r.row,
      文本: r.data,
      分类: r.category ?? "",
      tag: r.tags.join(", "),
      来源: sources(r.sources),
    })),
  );

  add(
    "变动明细",
    report.changes.map((c) => ({
      编号: c.id,
      行: c.row,
      来源位置: c.src ? describeAnchor(c.src) : (c.segment_id ?? ""),
      部分: c.facet,
      类型: label(KIND_LABELS, c.kind),
      来由: label(ORIGIN_LABELS, c.origin),
      原值: c.before,
      新值: c.after,
      存疑原因: c.evidence?.flags ? String(c.evidence.flags) : "",
      决策: c.decisionId ?? "",
      说明: c.note ?? "",
    })),
  );

  add(
    "人工决策",
    report.decisions.map((d) => ({
      编号: d.id,
      标题: d.header,
      问题: d.question,
      选项: d.options.join(" / "),
      回答: [...d.selected, ...(d.other ? [`其他：${d.other}`] : [])].join("、"),
      状态: d.status,
      提问时间: d.askedAt,
      回答时间: d.answeredAt ?? "",
      影响: d.affects.join(", "),
    })),
  );

  add(
    "提案审批",
    report.operations.map((p) => ({
      编号: p.id,
      类型: p.kind ?? "",
      摘要: p.summary ?? "",
      状态: p.status,
      预期: JSON.stringify(p.expected ?? {}),
      审批人: p.decidedBy ?? "",
      审批时间: p.decidedAt ?? "",
      备注: p.decisionNote ?? "",
    })),
  );

  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
