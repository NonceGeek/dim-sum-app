import type { UIMessage } from "ai";
import { json } from "@/components/library-ops/ops-shared";
import { agentSessionHeader } from "@/lib/ingestion/agent-session";
import type { RunView } from "./types";

type Session = { token: string; expiresAt: string; agentBaseUrl: string };

/** token 剩余不足一分钟时提前续签 */
const REFRESH_MARGIN_MS = 60_000;

export class AgentError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type MessagePage = { messages: UIMessage[]; next_cursor: string | null };

/**
 * 浏览器直连入库 Agent 的会话接口。token 由 dim-sum-app 签发（10 分钟），只放内存，
 * 快过期或 Agent 返回 401 时重新签发。
 */
export class AgentClient {
  private session?: Promise<Session>;

  constructor(readonly taskId: string) {}

  private async current(force = false) {
    if (this.session && !force) {
      const session = await this.session.catch(() => undefined);
      if (session && Date.parse(session.expiresAt) - Date.now() > REFRESH_MARGIN_MS) return session;
    }
    this.session = fetch(`/api/admin/ingestion-tasks/${this.taskId}/session`, { method: "POST" }).then(
      (res) => json<Session>(res),
    );
    return this.session;
  }

  /** 供 chat transport 与事件流使用：已续签的完整 URL 与鉴权头 */
  async prepare(path = "", force = false) {
    const session = await this.current(force);
    return {
      url: `${session.agentBaseUrl}/v1/tasks/${encodeURIComponent(this.taskId)}${path}`,
      headers: { authorization: `Bearer ${session.token}`, ...agentSessionHeader(this.taskId) },
    };
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response | undefined;
    for (const force of [false, true]) {
      const { url, headers } = await this.prepare(path, force);
      response = await fetch(url, { ...init, headers: { ...headers, ...init.headers } });
      if (response.status !== 401) break;
    }
    const text = await response!.text();
    if (!response!.ok) throw new AgentError(response!.status, errorMessage(text));
    return (text ? JSON.parse(text) : undefined) as T;
  }

  getTask = () => this.request<{ run: RunView | null }>("");

  getMessages = (before?: string, subtaskId?: string) =>
    this.request<MessagePage>(
      `${subtaskId ? `/subtasks/${encodeURIComponent(subtaskId)}` : ""}/messages${
        before ? `?before=${encodeURIComponent(before)}` : ""
      }`,
    );

  getTurnMessages = (turnId: string) =>
    this.request<MessagePage>(`/turns/${encodeURIComponent(turnId)}/messages`);

  reconcileApproval = (approvalId: string) =>
    this.request(`/approvals/${encodeURIComponent(approvalId)}/reconcile`, { method: "POST" });

  cancelQuestion = (questionId: string) =>
    this.request(`/questions/${encodeURIComponent(questionId)}/cancel`, { method: "POST" });
}

function errorMessage(text: string) {
  try {
    return (JSON.parse(text) as { error?: string }).error ?? text;
  } catch {
    return text || "Request failed";
  }
}
