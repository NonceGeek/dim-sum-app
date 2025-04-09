import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';

interface AppState {
  // 主题
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        // 主题
        theme: 'light',
        setTheme: (theme) => set({ theme }),
      }),
      {
        name: 'app-storage',
        storage: createJSONStorage(() => localStorage),
      }
    )
  )
); 