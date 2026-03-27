import { create } from "zustand";
import type { CategoryInfo } from "@/lib/api/category";
import { fetchAllCategories } from "@/lib/api/category";

interface CategoryStore {
  categories: CategoryInfo[];
  loaded: boolean;
  fetchCategories: () => Promise<void>;
  /** 根据 corpus name 获取中文 nickname，找不到则返回原始 name */
  getNickname: (name: string) => string;
}

export const useCategoryStore = create<CategoryStore>((set, get) => ({
  categories: [],
  loaded: false,

  fetchCategories: async () => {
    if (get().loaded) return;
    try {
      const categories = await fetchAllCategories();
      set({ categories, loaded: true });
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    }
  },

  getNickname: (name: string) => {
    const cat = get().categories.find((c) => c.name === name);
    return cat?.nickname || name;
  },
}));
