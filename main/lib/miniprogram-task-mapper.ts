import { AgentTask } from "@/lib/services/agent";

export interface MiniprogramSentiment {
  sentiment: string;
  exampleSentences: string[];
}

export interface MiniprogramTaskEntry {
  data: string;
  source: string;
  cantonesePronunciations: string[];
  phrases: string[];
  sentiments: MiniprogramSentiment[];
}

export interface MiniprogramTaskListItem {
  taskName: string;
  taskId: string;
  completedAt: string;
  status: string;
  processedBy: string;
  entries: MiniprogramTaskEntry[];
}

const STATUS_LABELS: Record<string, string> = {
  created: "未查看",
  notified: "已通知",
  in_progress: "处理中",
  reassigning: "转派中",
  completed: "已完成",
  cancelled: "已取消",
};

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function buildEntry(task: AgentTask): MiniprogramTaskEntry {
  const baseData =
    task.context?.problemChar ||
    task.context?.sentenceText ||
    task.context?.corpusName ||
    "任务";

  const pronunciations =
    task.violationType === "phonetic_mismatch"
      ? unique((task.suggestions || []).map((s) => s.value).filter(Boolean))
      : [];

  return {
    data: baseData,
    source: task.context?.corpusName || "Agent",
    cantonesePronunciations: pronunciations,
    phrases: task.context?.sentenceText ? [task.context.sentenceText] : [],
    sentiments: [],
  };
}

export function mapTaskToListItem(task: AgentTask): MiniprogramTaskListItem {
  return {
    taskName:
      task.context?.problemChar ||
      task.context?.sentenceText ||
      task.context?.corpusName ||
      "任务",
    taskId: task.id,
    completedAt: task.completedAt || task.updatedAt || "",
    status: STATUS_LABELS[task.status] || task.status,
    processedBy: task.processedBy || "",
    entries: [buildEntry(task)],
  };
}

export function mapTasksToList(tasks: AgentTask[]): MiniprogramTaskListItem[] {
  return tasks.map(mapTaskToListItem);
}

export function mapTaskToEntries(task: AgentTask): MiniprogramTaskEntry[] {
  return [buildEntry(task)];
}

