/** 列表与详情展示的状态：任务表只存人为决定的状态，处理中的细分由 Agent 会话状态推出 */
export const DISPLAY_STATUSES = {
  PENDING: "草稿",
  PROCESSING: "处理中",
  WAITING_APPROVAL: "待审批",
  WAITING_INPUT: "待回复",
  ERROR: "异常",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
} as const;
export type DisplayStatus = keyof typeof DISPLAY_STATUSES;

export function displayStatus(taskStatus: string, runStatus: string | null): DisplayStatus {
  if (taskStatus === "COMPLETED") return "COMPLETED";
  if (taskStatus === "CANCELLED") return "CANCELLED";
  if (taskStatus === "PENDING" || !runStatus) return "PENDING";
  switch (runStatus) {
    case "waiting_approval":
      return "WAITING_APPROVAL";
    case "waiting_input":
      return "WAITING_INPUT";
    case "failed":
    case "interrupted":
      return "ERROR";
    default:
      return "PROCESSING";
  }
}
