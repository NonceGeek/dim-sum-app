import api from "./client";
import { LyricsResult } from "./search";

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
    corpus_unique_id: string;
  };
}
interface IResults {
  interaction_id: string;
  is_liked: boolean;
  is_bookmarked: boolean;
  is_viewed: boolean;
  interaction_created_at: Date;
  interaction_updated_at: Date;
  corpus: {
    liked_num: string;
    bookmark_num: string;
    view_num: string;
    category: string;
    data: string;
    created_at: Date;
    note:
      | {
          context: {
            lyricist?: string;
            composer?: string;
            introduction?: string;
            song_name?: string;
            author?: string;
            album?: string;
            audio?: string;
            lyric?: LyricsResult[];
            page?: number;
            number?: string;
            others?: {
              異體?: any[];
              校訂註?: string | null;
            };
            pinyin?: string[];
            meaning?: string[];
          };
          contributor?: string;
        }
      | {
          context: {
            pron?: string;
            author?: string;
            video?: string;
            subtitle?: string;
            [key: string]: any;
          };
          contributor: string;
        };
    tags: string[];
    editable_level: number;
    unique_id: string;
  };
}

export interface IGetInteractListResult {
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
  results: IResults[];
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
  getBookmarkedList: (page: number, page_size: number, search: string) =>
    api.get<IGetInteractListResult>(
      `/api/user/corpus/interactions?type=bookmarked&page=${page}&limit=${page_size}&search=${encodeURIComponent(search)}`
    ),
  getLikedList: (page: number, page_size: number, search: string) =>
    api.get<IGetInteractListResult>(
      `/api/user/corpus/interactions?type=liked&page=${page}&limit=${page_size}&search=${encodeURIComponent(search)}`
    ),
};
