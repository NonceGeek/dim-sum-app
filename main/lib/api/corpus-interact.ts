import api from "./client";

export interface IStats {
  unique_id: string;
  stats: {
    likes: number;
    bookmarks: number;
    views: number;
  };
  user_status: {
    is_liked: boolean;
    is_bookmarked: boolean;
  } | null;
}

export interface IUpdateViewResult {
  unique_id: string;
  stats: {
    likes: number;
    bookmarks: number;
    views: number;
  };
  user_status: {
    is_liked: boolean;
    is_bookmarked: boolean;
    is_viewed: boolean;
  } | null;
}

export interface IUpdateInteractProps {
  corpus_unique_id: string;
  is_liked?: boolean;
  is_bookmarked?: boolean;
}

export interface IUpdateInteractResult {
  success: boolean;
  interaction: {
    is_liked: boolean;
    is_bookmarked: boolean;
    created_at: string;
    updated_at: string;
  };
}

export const corpusInteractApi = {
  getStats: (unique_id: string) =>
    api.get<IStats>(`/api/public/corpus/stats?unique_id=${unique_id}`),
  updateView: (corpus_unique_id: string) =>
    api.post<IUpdateViewResult>(" /api/public/corpus/view", {
      corpus_unique_id,
    }),
  updateInteract: ({
    corpus_unique_id,
    is_liked,
    is_bookmarked,
  }: IUpdateInteractProps) =>
    api.post<IUpdateInteractResult>("/api/user/corpus/interactions", {
      corpus_unique_id,
      is_liked,
      is_bookmarked,
    }),
};
