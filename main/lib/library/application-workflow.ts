/** Contribution application review workflow (PRD #451/#452). Pure rules; persistence lives in the service. */
export const APPLICATION_STATUSES = [
  "PENDING_INITIAL_REVIEW",
  "IN_REVIEW",
  "PENDING_APPLICANT_INFO",
  "RIGHTS_PRIVACY_REVIEW",
  "ACCEPTED",
  "REJECTED",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const FINAL_STATUSES: readonly ApplicationStatus[] = [
  "ACCEPTED",
  "REJECTED",
];

export const APPLICATION_ACTIONS = [
  "assign",
  "contact-logs",
  "request-info",
  "info-received",
  "rights-review",
  "review-complete",
  "reject",
  "accept",
  "reopen",
] as const;
export type ApplicationAction = (typeof APPLICATION_ACTIONS)[number];

type Rule = {
  from: readonly ApplicationStatus[];
  /** null keeps the current status. */
  to: ApplicationStatus | null;
  adminOnly?: boolean;
};

const ACTIVE: readonly ApplicationStatus[] = [
  "PENDING_INITIAL_REVIEW",
  "IN_REVIEW",
  "PENDING_APPLICANT_INFO",
  "RIGHTS_PRIVACY_REVIEW",
];

export const APPLICATION_RULES: Record<ApplicationAction, Rule> = {
  assign: { from: ["PENDING_INITIAL_REVIEW", "IN_REVIEW"], to: "IN_REVIEW" },
  "contact-logs": { from: ACTIVE, to: null },
  "request-info": { from: ["IN_REVIEW"], to: "PENDING_APPLICANT_INFO" },
  "info-received": { from: ["PENDING_APPLICANT_INFO"], to: "IN_REVIEW" },
  "rights-review": { from: ["IN_REVIEW"], to: "RIGHTS_PRIVACY_REVIEW" },
  "review-complete": { from: ["RIGHTS_PRIVACY_REVIEW"], to: "IN_REVIEW" },
  reject: { from: ACTIVE, to: "REJECTED" },
  accept: { from: ["IN_REVIEW"], to: "ACCEPTED" },
  reopen: { from: ["REJECTED"], to: "IN_REVIEW", adminOnly: true },
};

/** Maps an action to the event type recorded in history. */
export const ACTION_EVENT: Record<ApplicationAction, string> = {
  assign: "assign",
  "contact-logs": "contact_log",
  "request-info": "request_info",
  "info-received": "info_received",
  "rights-review": "rights_review",
  "review-complete": "rights_review_complete",
  reject: "reject",
  accept: "accept",
  reopen: "reopen",
};

export function isApplicationAction(value: string): value is ApplicationAction {
  return (APPLICATION_ACTIONS as readonly string[]).includes(value);
}

export function transition(
  action: ApplicationAction,
  from: string,
  isAdmin: boolean,
): { ok: true; to: ApplicationStatus } | { ok: false; reason: string } {
  const rule = APPLICATION_RULES[action];
  if (rule.adminOnly && !isAdmin)
    return { ok: false, reason: "仅系统管理员可执行该操作" };
  if (!rule.from.includes(from as ApplicationStatus))
    return { ok: false, reason: "当前状态不允许该操作" };
  return { ok: true, to: rule.to ?? (from as ApplicationStatus) };
}

/** Actions offered in the UI for a status. */
export function availableActions(
  status: string,
  isAdmin: boolean,
): ApplicationAction[] {
  return APPLICATION_ACTIONS.filter(
    (action) => transition(action, status, isAdmin).ok,
  );
}

export const LEAD_STATUSES = [
  "PENDING_OWNER_ACCEPTANCE",
  "IN_PROGRESS",
  "CLOSED",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_ACTIONS = ["take", "close", "reassign"] as const;
export type LeadAction = (typeof LEAD_ACTIONS)[number];

export function leadTransition(
  action: LeadAction,
  from: string,
  { isAssignee, isAdmin }: { isAssignee: boolean; isAdmin: boolean },
): { ok: true; to: LeadStatus } | { ok: false; reason: string } {
  if (action === "reassign") {
    if (!isAdmin) return { ok: false, reason: "仅系统管理员可改派" };
    if (from === "CLOSED") return { ok: false, reason: "待办已关闭" };
    return { ok: true, to: "PENDING_OWNER_ACCEPTANCE" };
  }
  if (!isAssignee) return { ok: false, reason: "只有被指派人可以处理该待办" };
  if (action === "take")
    return from === "PENDING_OWNER_ACCEPTANCE"
      ? { ok: true, to: "IN_PROGRESS" }
      : { ok: false, reason: "当前状态不允许接手" };
  return from === "CLOSED"
    ? { ok: false, reason: "待办已关闭" }
    : { ok: true, to: "CLOSED" };
}

/** CA-20260913-008 / IL-20260913-001; date in Asia/Shanghai. */
export function formatSerial(prefix: "CA" | "IL", date: Date, seq: number) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replaceAll("-", "");
  return `${prefix}-${day}-${String(seq).padStart(3, "0")}`;
}
