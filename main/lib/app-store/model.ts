import { z } from "zod";

export const CATEGORIES = [
  "learning",
  "ai",
  "game",
  "data",
  "community",
  "other",
] as const;
export const SORTS = ["recommended", "newest", "updated"] as const;
// URLs are displayed or opened by the user, never fetched by the server.
export function safeUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 2000)
    return "";
  try {
    const u = new URL(value.trim());
    return ["http:", "https:"].includes(u.protocol) &&
      !u.username &&
      !u.password
      ? u.href
      : "";
  } catch {
    return "";
  }
}
const url = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => !v || !!safeUrl(v), "Invalid HTTP(S) URL");
export const appDraftSchema = z.object({
  name: z.string().trim().max(100).default(""),
  summary: z.string().trim().max(240).default(""),
  description: z.string().trim().max(10000).default(""),
  authors: z.string().trim().max(300).default(""),
  category: z.enum(CATEGORIES).default("other"),
  kind: z.enum(["web", "miniprogram", "resource"]).default("web"),
  launchUrl: url.default(""),
  homepageUrl: url.default(""),
  githubUrl: url.default(""),
  coverUrl: url.default(""),
  iconUrl: url.default(""),
  qrUrl: url.default(""),
  demoUrl: url.default(""),
  demoType: z.enum(["image", "video"]).default("video"),
  access: z.enum(["unknown", "direct", "request"]).default("unknown"),
  login: z.enum(["unknown", "none", "required"]).default("unknown"),
  devices: z.enum(["unknown", "both", "desktop", "mobile"]).default("unknown"),
  badge: z.enum(["", "featured", "experimental"]).default(""),
  notice: z.string().trim().max(1500).default(""),
  privacyUrl: url.default(""),
  rank: z.number().int().min(0).max(999999).default(0),
});
export type AppDraft = z.infer<typeof appDraftSchema>;
export type StoreApp = AppDraft & {
  id: string;
  publishedAt: string;
  updatedAt: string;
};
export const EMPTY_DRAFT = appDraftSchema.parse({});

export function publishIssues(d: AppDraft): string[] {
  const issues: string[] = [];
  if (!d.name) issues.push("name");
  if (!d.summary) issues.push("summary");
  if (!d.authors) issues.push("authors");
  if (d.kind === "miniprogram" ? !d.qrUrl : !d.launchUrl)
    issues.push(d.kind === "miniprogram" ? "qrUrl" : "launchUrl");
  if (d.launchUrl && !d.launchUrl.startsWith("https://")) issues.push("https");
  return issues;
}
export function categoryCode(type: string | null | undefined) {
  const t = (type ?? "").toLowerCase();
  if (["study", "learning", "学习", "学粤语"].includes(t)) return "learning";
  if (["ai", "tool", "ai 工具"].includes(t)) return "ai";
  if (["game", "gaming", "游戏"].includes(t)) return "game";
  if (["data", "语料", "语料与数据"].includes(t)) return "data";
  if (["community", "共建", "社区共建"].includes(t)) return "community";
  return "other";
}
export type LegacyApp = {
  id: bigint;
  name: string | null;
  description: string | null;
  authors: unknown;
  type: string;
  url: string | null;
  homepage_url: string | null;
  github_url: string | null;
  icon_img: string | null;
  example_img: string | null;
  wechat_micro_app: string | null;
  pinned: boolean | null;
  sorting: bigint;
  created_at: Date;
  updated_at: Date | null;
};
export function legacyDraft(row: LegacyApp): AppDraft {
  return appDraftSchema.parse({
    name: (row.name ?? "").slice(0, 100),
    summary: (row.description ?? "").slice(0, 240),
    description: (row.description ?? "").slice(0, 10000),
    authors: Array.isArray(row.authors)
      ? row.authors
          .filter((v) => typeof v === "string")
          .join(", ")
          .slice(0, 300)
      : "",
    category: categoryCode(row.type),
    launchUrl: safeUrl(row.url),
    homepageUrl: safeUrl(row.homepage_url),
    githubUrl: safeUrl(row.github_url),
    coverUrl: safeUrl(row.icon_img),
    qrUrl: safeUrl(row.wechat_micro_app),
    kind: row.wechat_micro_app && !row.url ? "miniprogram" : "web",
    demoUrl: safeUrl(row.example_img),
    demoType: /\.(png|jpe?g|gif|webp)(\?|$)/i.test(row.example_img ?? "")
      ? "image"
      : "video",
    badge: row.pinned ? "featured" : "",
    rank: Math.max(0, Math.min(999999, Number(row.sorting))),
  });
}
export function catalog(
  items: StoreApp[],
  q = "",
  category = "",
  instant = false,
  sort = "recommended",
) {
  const term = q.trim().toLocaleLowerCase();
  return items
    .filter(
      (a) =>
        (!term ||
          [a.name, a.summary, a.description, a.authors]
            .join(" ")
            .toLocaleLowerCase()
            .includes(term)) &&
        (!category || a.category === category) &&
        (!instant || a.access === "direct"),
    )
    .sort((a, b) => {
      if (sort === "newest")
        return (
          b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id)
        );
      if (sort === "updated")
        return (
          b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)
        );
      return (
        (a.rank || 999999) - (b.rank || 999999) ||
        Number(b.badge === "featured") - Number(a.badge === "featured") ||
        a.id.localeCompare(b.id)
      );
    });
}
