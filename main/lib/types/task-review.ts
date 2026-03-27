import type {
  AgentTask,
  AgentTaskStatus,
  AgentTaskContext,
  AgentSuggestion,
  AgentTaskListResponse,
  AgentPagination,
  AgentTaskStatsResponse,
} from "@/lib/services/agent";

// Re-export for convenience
export type {
  AgentTask,
  AgentTaskStatus,
  AgentTaskContext,
  AgentSuggestion,
  AgentTaskListResponse,
  AgentPagination,
  AgentTaskStatsResponse,
};

// ---- Content Block Types ----

export type BlockType =
  | "phrase"
  | "sentence"
  | "definition"
  | "introduction"
  | "audio"
  | "emotion"
  | "other";

export interface ContentBlock {
  type: BlockType;
  content?: string;
  url?: string;
  duration?: number;
  category?: string; // emotion category
  intensity?: string; // emotion intensity
  new?: boolean;
}

export interface CantonesePronunciationItem {
  jyutping: string;
  blocks: ContentBlock[];
  new?: boolean;
}

export interface CantonesePronunciationRecord {
  text?: string;
  data: CantonesePronunciationItem[];
}

// ---- Task Detail (extended from AgentTask) ----

export interface TaskSuggestion {
  kind: "original" | "baseline" | "llm";
  value?: string;
  lexiconBaseCorpusName?: string;
  record: CantonesePronunciationRecord;
}

export interface TaskDetail {
  id: string;
  status: AgentTaskStatus;
  violationType: string;
  context: AgentTaskContext;
  suggestions?: TaskSuggestion[];
  selectedSuggestion?: TaskSuggestion;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  actorRef?: string;
  processedBy?: string;
}

// ---- Dashboard Types ----

export interface TaskStatsAssignee {
  id: string;
  name: string | null;
  avatar: string | null;
}

export interface TaskStatsItemWithUser extends TaskStatsItem {
  name: string | null;
  avatar: string | null;
}

export interface TaskStatsWithAssignees extends AgentTaskStatsResponse {
  assignees: TaskStatsAssignee[];
  items: TaskStatsItemWithUser[];
}

export interface PublicUser {
  userId: string;
  username: string;
  avatar: string | null;
}

// ---- Query Params ----

export interface TaskListParams {
  status?: string;
  page?: number;
  pageSize?: number;
  corpusName?: string;
  violationType?: string;
  assigneeRef?: string;
  q?: string;
}

export interface TaskStatsParams {
  corpusName: string;
  assigneeRef?: string;
}

// ---- Emotion Constants ----

export const EMOTION_CATEGORIES = [
  "愤怒（angry）",
  "恐惧（fear）",
  "高兴（happy）",
  "中性（neutral）",
  "悲伤（sad）",
  "惊讶（surprise）",
  "活泼（lively）",
  "困惑（confused）",
  "担心（worry）",
  "厌恶（disgust）",
  "焦虑（anxious）",
  "正直（upright）",
  "冷漠（clam）",
  "温柔（gentle）",
  "兴奋（excited）",
  "稳重（steady）",
] as const;

export const INTENSITY_LEVELS = [
  "弱",
  "较弱",
  "一般",
  "较强",
  "强",
] as const;

export type EmotionCategory = (typeof EMOTION_CATEGORIES)[number];
export type IntensityLevel = (typeof INTENSITY_LEVELS)[number];

// ---- User Permission Types ----

export interface UserTaskPermissions {
  role: string | null;
  isSystemAdmin: boolean;
  writeCorpora: string[];
}

/**
 * Per-suggestion auth result, matching mini-program getAuthCorpus logic.
 * canEdit: list of corpus source names the user may edit
 * canAdd: whether user may add new suggestions
 * canDelete: whether user may delete suggestions
 */
export interface SuggestionAuth {
  canEdit: string[];
  canAdd: boolean;
  canDelete: boolean;
}

// ---- Per-User Stats (from agent /tasks/stats items) ----

export interface TaskStatsItem {
  assigneeRef: string;
  corpusId: string;
  totalCount: number;
  processedCount: number;
  unprocessedCount: number;
  totalCorpusCount: number | null;
  completionRate: number;
}

// ---- Dataset / Corpus Types ----

export interface Dataset {
  label: string;
  value: string;
}
