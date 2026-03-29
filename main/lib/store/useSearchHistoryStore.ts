import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_HISTORY = 15;

interface SearchHistoryState {
  history: string[];
  add: (term: string) => void;
  remove: (term: string) => void;
  clear: () => void;
}

export const useSearchHistoryStore = create<SearchHistoryState>()(
  persist(
    (set) => ({
      history: [],
      add: (term) => {
        const trimmed = term.trim();
        if (!trimmed) return;
        set((state) => {
          const deduped = state.history.filter((h) => h !== trimmed);
          return { history: [trimmed, ...deduped].slice(0, MAX_HISTORY) };
        });
      },
      remove: (term) =>
        set((state) => ({ history: state.history.filter((h) => h !== term) })),
      clear: () => set({ history: [] }),
    }),
    { name: 'dimsum-search-history' }
  )
);
