import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { putNewObject } from "../oss";
import { assembleReport } from "./assemble";
import { loadReportInput } from "./load";
import { writeNarrative } from "./narrative";
import { renderMarkdown } from "./render-md";
import { renderXlsx } from "./render-xlsx";
import type { ReportKind, ReportV1 } from "./types";

export type ReportFormat = "json" | "md" | "xlsx";

export const REPORT_FORMATS: Record<ReportFormat, { ext: string; contentType: string }> = {
  json: { ext: "json", contentType: "application/json; charset=utf-8" },
  md: { ext: "md", contentType: "text/markdown; charset=utf-8" },
  xlsx: {
    ext: "xlsx",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
};

/** 生成中超过这个时间视为中断（after() 不保证执行完），可以重新生成 */
export const GENERATING_STALE_MS = 15 * 60 * 1000;

export const reportFileName = (version: number, format: ReportFormat) =>
  `report.v${version}.${REPORT_FORMATS[format].ext}`;

function summaryOf(report: ReportV1) {
  const s = report.summary;
  return {
    inserted: s.inserted,
    skipped: s.skipped,
    changes: s.changes,
    attention: s.attention,
    unexplained: s.unexplained,
    decisions: s.decisions,
    openIssues: s.openIssues,
    lineage: report.meta.lineage,
  };
}

async function claimVersion(taskId: bigint, kind: ReportKind, basePath: string, actor: string | null) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const last = await prisma.ingestion_reports.findFirst({
      where: { task_id: taskId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    try {
      return await prisma.ingestion_reports.create({
        data: {
          task_id: taskId,
          version: (last?.version ?? 0) + 1,
          kind,
          status: "generating",
          base_path: basePath,
          generated_by: actor,
        },
      });
    } catch (error) {
      // 并发生成撞了版本号，重试
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    }
  }
  throw new Error("无法分配报告版本号");
}

/**
 * 生成入库报告：组装系统记录 → 写 JSON → AI 导读并校验 → 写 Markdown 与 Excel。
 * 文件写在批次工作区 report/ 下，不覆盖旧版本；AI 导读失败时报告仍可用（ready_without_narrative）。
 */
export async function generateReport(
  taskId: bigint,
  opts: { kind: ReportKind; actor?: string | null; narrative?: boolean },
) {
  const task = await prisma.ingestion_tasks.findUniqueOrThrow({
    where: { id: taskId },
    select: { workspace_prefix: true },
  });
  const basePath = `${task.workspace_prefix}report/`;
  const row = await claimVersion(taskId, opts.kind, basePath, opts.actor ?? null);
  const formats: ReportFormat[] = [];
  const put = async (format: ReportFormat, body: string | Buffer) => {
    await putNewObject(basePath + reportFileName(row.version, format), body, REPORT_FORMATS[format].contentType);
    formats.push(format);
  };
  try {
    const report = assembleReport(await loadReportInput(taskId), {
      kind: opts.kind,
      version: row.version,
    });
    const json = JSON.stringify(report, null, 2);
    await put("json", json);
    await prisma.ingestion_reports.update({
      where: { id: row.id },
      data: {
        formats,
        facts_hash: createHash("sha256").update(json).digest("hex"),
        summary: summaryOf(report),
      },
    });

    const useNarrative = opts.narrative ?? opts.kind === "final";
    const narrative = useNarrative ? await writeNarrative(report) : null;
    const narrativeError = narrative
      ? narrative.narrative
        ? undefined
        : (narrative.meta.attempts.at(-1)?.error ?? "AI 导读未通过校验")
      : undefined;
    await put("md", renderMarkdown(report, narrative?.narrative ?? null, { narrativeError }));
    await put("xlsx", renderXlsx(report));
    return await prisma.ingestion_reports.update({
      where: { id: row.id },
      data: {
        formats,
        status: narrative?.narrative ? "ready" : useNarrative ? "ready_without_narrative" : "ready",
        narrative_meta: (narrative?.meta ?? { skipped: true }) as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    await prisma.ingestion_reports.update({
      where: { id: row.id },
      data: {
        formats,
        status: "failed",
        error: (error instanceof Error ? error.message : String(error)).slice(0, 2000),
      },
    });
    throw error;
  }
}

/** 任务结束后在后台生成正式报告；失败只记录在报告行上 */
export function scheduleFinalReport(taskId: bigint, actor: string | null) {
  return generateReport(taskId, { kind: "final", actor }).catch((error) => {
    console.error(`[ingestion-report] task ${taskId} failed`, error);
  });
}

/** 任务已结束但没有可用的正式报告（未生成，或上次生成中途中断）时需要补生成 */
export async function needsFinalReport(taskId: bigint, now = Date.now()) {
  const latest = await prisma.ingestion_reports.findFirst({
    where: { task_id: taskId, kind: "final" },
    orderBy: { version: "desc" },
    select: { status: true, updated_at: true },
  });
  if (!latest) return true;
  return latest.status === "generating" && now - latest.updated_at.getTime() > GENERATING_STALE_MS;
}
