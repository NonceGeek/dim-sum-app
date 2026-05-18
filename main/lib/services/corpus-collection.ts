import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const PUBLIC_SUBMISSION_WHERE = {
  review_status: "approved",
  visibility: "public",
} as const;

export function parsePositiveInt(value: string | null, fallback: number, max = 100) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

export function parseBigIntId(value: string | undefined | null) {
  if (!value || !/^\d+$/.test(value)) return null;
  return BigInt(value);
}

export function jsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return value as Prisma.InputJsonValue;
}

export function formatCompactCount(value: number | null | undefined) {
  const count = Number(value ?? 0);
  if (count >= 10000) return `${(count / 10000).toFixed(count >= 100000 ? 0 : 1)}万`;
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k`;
  return count.toString();
}

function serializeUser(user?: {
  id: string;
  name: string | null;
  image?: string | null;
  wechatAvatar?: string | null;
} | null) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    avatar: user.wechatAvatar || user.image || null,
  };
}

function getSubmissionImages(submission: any) {
  return (submission.media ?? [])
    .filter((item: any) => item.media_type === "image")
    .map((item: any) => item.url);
}

export function serializeActivity(activity: any) {
  return {
    id: activity.id.toString(),
    title: activity.title,
    slug: activity.slug,
    description: activity.description,
    rules: activity.rules,
    rewardConfig: activity.reward_config,
    mediaRequirements: activity.media_requirements,
    bannerUrl: activity.banner_url,
    status: activity.status,
    startsAt: activity.starts_at?.toISOString?.() ?? null,
    endsAt: activity.ends_at?.toISOString?.() ?? null,
    submissionCount: activity._count?.submissions ?? activity.submissionCount ?? undefined,
    works: activity.submissions
      ? activity.submissions.map((item: any) => serializeSubmission(item))
      : undefined,
    createdAt: activity.created_at?.toISOString?.() ?? undefined,
    updatedAt: activity.updated_at?.toISOString?.() ?? undefined,
  };
}

export function serializeSubmission(submission: any, viewerLiked?: boolean) {
  const imageUrls = getSubmissionImages(submission);
  return {
    id: submission.id.toString(),
    title: submission.title,
    intro: submission.intro,
    submissionType: submission.submission_type,
    tags: submission.tags,
    reviewStatus: submission.review_status,
    reviewReason: submission.review_reason,
    isFeatured: submission.is_featured,
    showOnHome: submission.show_on_home,
    visibility: submission.visibility,
    likeCount: submission.like_count,
    commentCount: submission.comment_count,
    shareCount: submission.share_count,
    viewCount: submission.view_count,
    views: formatCompactCount(submission.view_count),
    isAwarded: submission.is_awarded,
    awardStatus: submission.award_status,
    awardInfo: submission.award_info,
    coverUrl: imageUrls[0] ?? null,
    imageUrls,
    liked: viewerLiked,
    activity: submission.activity
      ? {
          id: submission.activity.id.toString(),
          title: submission.activity.title,
        }
      : null,
    author: serializeUser(submission.user),
    media: (submission.media ?? []).map((item: any) => ({
      id: item.id.toString(),
      type: item.media_type,
      url: item.url,
      durationSec: item.duration_seconds,
      sortOrder: item.sort_order,
      metadata: item.metadata,
    })),
    precheckResult: submission.precheck_result,
    aiReviewResult: submission.ai_review_result,
    createdAt: submission.created_at?.toISOString?.() ?? undefined,
    updatedAt: submission.updated_at?.toISOString?.() ?? undefined,
  };
}

export function serializeHomeSubmission(submission: any) {
  const author = serializeUser(submission.user);
  const imageUrls = getSubmissionImages(submission);
  return {
    id: submission.id.toString(),
    imageUrl: imageUrls[0] ?? "",
    author: author?.name ?? "用户昵称",
    avatar: author?.avatar ?? "",
    views: formatCompactCount(submission.view_count),
  };
}

export const submissionInclude = {
  activity: { select: { id: true, title: true } },
  user: { select: { id: true, name: true, image: true, wechatAvatar: true } },
  media: { orderBy: { sort_order: "asc" } },
} satisfies Prisma.corpus_collection_submissionsInclude;

export async function listPublicSubmissions(options: {
  activityId?: bigint | null;
  featured?: boolean;
  showOnHome?: boolean;
  type?: string | null;
  page: number;
  pageSize: number;
  sort?: "latest" | "likes";
  includeRaw?: boolean;
}) {
  const where: Prisma.corpus_collection_submissionsWhereInput = {
    ...PUBLIC_SUBMISSION_WHERE,
    activity_id: options.activityId ?? undefined,
    is_featured: options.featured ? true : undefined,
    show_on_home: options.showOnHome ? true : undefined,
    submission_type: options.type || undefined,
  };
  const [items, total] = await Promise.all([
    prisma.corpus_collection_submissions.findMany({
      where,
      include: submissionInclude,
      orderBy:
        options.sort === "likes"
          ? [{ like_count: "desc" }, { created_at: "desc" }]
          : { created_at: "desc" },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
    }),
    prisma.corpus_collection_submissions.count({ where }),
  ]);

  return {
    items: items.map((item) => serializeSubmission(item)),
    ...(options.includeRaw ? { rawItems: items } : {}),
    pagination: { page: options.page, pageSize: options.pageSize, total },
  };
}

export function validateSubmissionMedia(media: unknown[]) {
  const images = media.filter((item: any) => item?.type === "image");
  const audios = media.filter((item: any) => item?.type === "audio");
  const videos = media.filter((item: any) => item?.type === "video");

  if (images.length < 1 || images.length > 9) return false;
  if (audios.length < 1) return false;
  if (audios.some((item: any) => Number(item.durationSec ?? 0) > 60)) return false;
  if (videos.some((item: any) => Number(item.durationSec ?? 0) > 30)) return false;
  return true;
}

export async function createCorpusSubmission(userId: string, body: any) {
  const media = Array.isArray(body.media) ? body.media : [];
  if (
    !body.submissionType ||
    !body.title ||
    !body.intro ||
    !Array.isArray(body.tags) ||
    body.tags.length === 0
  ) {
    throw new Error("Missing required fields");
  }

  if (!validateSubmissionMedia(media)) {
    throw new Error("Invalid media requirements");
  }

  const activityId = parseBigIntId(body.activityId);

  return prisma.corpus_collection_submissions.create({
    data: {
      user_id: userId,
      activity_id: activityId,
      submission_type: body.submissionType,
      title: body.title,
      intro: body.intro,
      tags: body.tags as Prisma.InputJsonValue,
      precheck_result: jsonInput(body.precheckResult),
      review_status: "pending_review",
      visibility: "private",
      media: {
        create: media.map((item: any, index: number) => ({
          media_type: item.type,
          url: item.url,
          duration_seconds:
            typeof item.durationSec === "number" ? Math.floor(item.durationSec) : null,
          sort_order: typeof item.sortOrder === "number" ? item.sortOrder : index,
          metadata: (item.metadata ?? {}) as Prisma.InputJsonValue,
        })),
      },
    },
    include: submissionInclude,
  });
}

export function getCallbackBaseUrl(reqUrl?: string) {
  const configured = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (reqUrl) {
    const url = new URL(reqUrl);
    return `${url.protocol}//${url.host}`;
  }
  return "https://search.aidimsum.com";
}
