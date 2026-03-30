import api from "@/lib/api/client";
import type {
  AgentTaskListResponse,
  TaskDetail,
  TaskStatsWithAssignees,
  TaskListParams,
  TaskStatsParams,
  PublicUser,
  UserTaskPermissions,
} from "@/lib/types/task-review";

const BASE = "/api/data-annotation/tasks";

function buildQuery(params: Record<string, string | number | undefined>) {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== ""
  );
  if (entries.length === 0) return "";
  return "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
}

export const taskReviewApi = {
  getTasks(params: TaskListParams = {}) {
    const query = buildQuery({
      status: params.status,
      page: params.page,
      pageSize: params.pageSize,
      corpusName: params.corpusName,
      violationType: params.violationType,
      assigneeRef: params.assigneeRef,
      q: params.q,
    });
    return api.get<AgentTaskListResponse>(`${BASE}${query}`);
  },

  getTask(id: string) {
    return api.get<TaskDetail>(`${BASE}/${id}`);
  },

  completeTask(id: string, data: { selected: unknown[] }) {
    return api.post<{ ok?: boolean }>(`${BASE}/${id}/complete`, data);
  },

  skipTask(id: string) {
    return api.post<{ ok?: boolean }>(`${BASE}/${id}/skip`);
  },

  viewTask(id: string) {
    return api.post<unknown>(`${BASE}/${id}/view`);
  },

  getStats(params: TaskStatsParams) {
    const query = buildQuery({
      corpusName: params.corpusName,
      assigneeRef: params.assigneeRef,
    });
    return api.get<TaskStatsWithAssignees>(`${BASE}/stats${query}`);
  },

  uploadAudio(formData: FormData) {
    return api.post<{ url: string }>(`${BASE}/upload`, formData);
  },

  getUsers(userIds: string[]) {
    const query = buildQuery({ userIds: userIds.join(",") });
    return api.get<{ users: PublicUser[]; total: number }>(
      `${BASE}/users${query}`
    );
  },

  getUserPermissions() {
    return api.get<UserTaskPermissions>(`${BASE}/user-permissions`);
  },
};
