export type AgentTaskStatus =
  | "created"
  | "notified"
  | "in_progress"
  | "reassigning"
  | "completed"
  | "cancelled";

export interface AgentTaskContext {
  corpusName?: string;
  corpusUniqueId?: string;
  sentenceText?: string;
  problemChar?: string;
}

export type AgentSuggestionSource = "lexicon" | "llm";

export interface AgentSuggestion {
  source: AgentSuggestionSource;
  value: string;
  lexiconBaseCorpusName?: string;
  position?: { index: number };
  explanation?: string;
}

export interface AgentTask {
  id: string;
  status: AgentTaskStatus;
  violationType: string;
  context: AgentTaskContext;
  suggestions?: AgentSuggestion[];
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  actorRef?: string;
  processedBy?: string;
}

export interface AgentPagination {
  page: number;
  pageSize: number;
  total: number;
}

export interface AgentTaskListResponse {
  items: AgentTask[];
  pagination: AgentPagination;
}

export interface AgentRun {
  id: string;
  status: string;
  ruleId?: string;
  ruleVersion?: string;
  corpusName?: string;
  corpusId?: string;
  taskType?: string;
  totalRecords?: number;
  totalRecordsChecked?: number;
  recordsWithViolations?: number;
  totalViolations?: number;
  createdAt: string;
  updatedAt?: string;
  endedAt?: string;
}

export interface AgentRunListResponse {
  items: AgentRun[];
  pagination: AgentPagination;
}

export interface AgentCompileResponse {
  pass: boolean;
  failureReason?: string;
}

export interface AgentDescriptor {
  id: string;
  name: string;
}

export interface AgentTaskQuery {
  actorRef: string;
  status?: string;
  page?: number;
  pageSize?: number;
  corpusName?: string;
  violationType?: string;
}

export interface RuleRunPayload {
  ruleText: string;
  ruleId: string;
  ruleVersion?: string;
  corpusName: string;
  agentId?: string;
  agentIds?: string[];
}

export class AgentApiError extends Error {
  constructor(
    public status: number,
    public payload: unknown,
    message = "Agent API request failed"
  ) {
    super(message);
    this.name = "AgentApiError";
  }
}

const getAgentBaseUrl = () => {
  const baseUrl = process.env.AGENT_API_BASE_URL;
  if (!baseUrl) {
    throw new Error("AGENT_API_BASE_URL is not configured");
  }
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
};

const getAgentAuthHeader = () => {
  const token = process.env.AGENT_API_TOKEN;
  if (!token) {
    return {};
  }
  return {
    Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
  };
};

type AgentFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string | number | undefined | null>;
};

async function agentFetch<T>(
  path: string,
  options: AgentFetchOptions = {}
): Promise<T> {
  const baseUrl = getAgentBaseUrl();
  const url = new URL(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`);

  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...getAgentAuthHeader(),
    ...options.headers,
  };

  const init: RequestInit = {
    method: options.method ?? "GET",
    headers,
    cache: "no-store",
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
  // console.log("agentFetch url", url.toString());
  // console.log("agentFetch init", init);
  const response = await fetch(url, init);
  // console.log("agentFetch response", response);
  const parsePayload = async () => {
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : undefined;
    } catch {
      return text;
    }
  };

  if (!response.ok) {
    const payload = await parsePayload();
    throw new AgentApiError(response.status, payload);
  }

  const payload = await parsePayload();
  return payload as T;
}

export async function fetchAgentTasks(query: AgentTaskQuery) {
  console.log("query fetchAgentTasks", query);
  return agentFetch<AgentTaskListResponse>("/tasks", {
    query: {
      actorRef: query.actorRef,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
      corpusName: query.corpusName,
      violationType: query.violationType,
    },
  });
}

export async function fetchAgentTask(taskId: string) {
  console.log("taskId fetchAgentTask", taskId);
  return agentFetch<AgentTask>(`/tasks/${taskId}`);
}

export async function completeAgentTask(
  taskId: string,
  payload: { actorRef: string; selected: unknown[] }
) {
  console.log("payload completeAgentTask", payload);
  return agentFetch(`/tasks/${taskId}/complete`, {
    method: "POST",
    body: {
      actorRef: payload.actorRef,
      selected: payload.selected,
    },
  });
}

export async function skipAgentTask(
  taskId: string,
  payload: { actorRef: string }
) {
  return agentFetch(`/tasks/${taskId}/skip-and-reassign`, {
    method: "POST",
    body: {
      actorRef: payload.actorRef,
    },
  });
}

export async function fetchAgentRuns(
  query: Partial<Omit<RuleRunPayload, "ruleText">> & {
    page?: number;
    pageSize?: number;
    status?: string;
  }
) {
  return agentFetch<AgentRunListResponse>("/runs", {
    query: {
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
      ruleId: query.ruleId,
      corpusName: query.corpusName,
    },
  });
}

export async function triggerAgentRule(payload: RuleRunPayload) {
  return agentFetch("/rules/run", {
    method: "POST",
    body: payload,
  });
}

export async function compileAgentRule(ruleText: string) {
  return agentFetch<AgentCompileResponse>("/rules/compile", {
    method: "POST",
    body: { ruleText },
  });
}

export async function fetchAgentDescriptors() {
  return agentFetch<AgentDescriptor[]>("/agents");
}
