import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
  isOpen: boolean;
  isMobile: boolean;
  setOpen: (open: boolean) => void;
  setMobile: (isMobile: boolean) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isOpen: false,
      isMobile: false,
      setOpen: (open) => set({ isOpen: open }),
      setMobile: (isMobile) => set({ isMobile }),
    }),
    {
      name: 'sidebar-storage',
    }
  )
); 