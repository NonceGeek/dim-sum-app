import { randomBytes } from "node:crypto";
import { posix } from "node:path";

/** 入库任务业务状态；处理中的细分状态由 Agent 会话状态推出，见 display-status.ts */
export const TASK_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const isTaskClosed = (status: string) =>
  status === "COMPLETED" || status === "CANCELLED";

/** 会话未开始或停在可继续的状态时才能补传原始文件；与 Agent 的上传规则一致 */
export const UPLOADABLE_RUN_STATUSES = ["ready", "failed"] as const;

export function canUploadFiles(taskStatus: string, runStatus: string | null) {
  if (isTaskClosed(taskStatus)) return false;
  return runStatus === null || (UPLOADABLE_RUN_STATUSES as readonly string[]).includes(runStatus);
}

/**
 * 任务工作区：任务编号 + 随机后缀，如 batches/IT-20261026-001-k3f9x2/（RAM 授权按 batches/* 配）。
 * 任务编号只在本库内唯一，各测试库共用一个 bucket，靠后缀避免撞路径。
 */
export function workspacePrefix(taskNo: string): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  while (suffix.length < 6) {
    for (const b of randomBytes(8)) {
      // 252 = 36 * 7，丢弃余下的值避免取模偏差
      if (b < 252 && suffix.length < 6) suffix += alphabet[b % 36];
    }
  }
  return `batches/${taskNo}-${suffix}/`;
}

/** 上传路径相对任务工作区的 input/，拒绝绝对路径与 .. 穿越 */
export function inputPath(path: string) {
  if (!path || path.includes("\0") || path.startsWith("/"))
    throw new Error("上传路径必须是相对路径");
  const normalized = posix.normalize(path.replaceAll("\\", "/"));
  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.split("/").some((part) => !part || part === "." || part === "..")
  )
    throw new Error(`非法上传路径: ${path}`);
  return `input/${normalized}`;
}
