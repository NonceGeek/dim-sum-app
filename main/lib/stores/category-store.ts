/**
 * category-store.ts
 *
 * 原先用 Zustand 独立 fetch categories，现已统一改为 useAllCategories (TanStack Query)。
 * 保留此文件仅为向后兼容旧的导入路径，实际逻辑已迁移至 lib/api/category.ts。
 *
 * @deprecated 请直接使用 useAllCategories + getCategoryNickname
 */
export { useAllCategories, getCategoryNickname } from "@/lib/api/category";
