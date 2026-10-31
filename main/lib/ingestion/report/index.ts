/**
 * 入库报告由入库 Agent（yue-lint-agent corpus-control/src/report）生成：
 * 对话中的草稿版与结束任务时的正式版，写在批次工作区 report/ 下并登记在 ingestion_reports。
 * 这里只负责列出与下载。
 */

export type ReportFormat = "json" | "md" | "xlsx";

export const REPORT_FORMATS: Record<ReportFormat, { ext: string; contentType: string }> = {
  json: { ext: "json", contentType: "application/json; charset=utf-8" },
  md: { ext: "md", contentType: "text/markdown; charset=utf-8" },
  xlsx: {
    ext: "xlsx",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
};

/** 生成中超过这个时间视为中断 */
export const GENERATING_STALE_MS = 15 * 60 * 1000;

export const reportFileName = (version: number, format: ReportFormat) =>
  `report.v${version}.${REPORT_FORMATS[format].ext}`;
