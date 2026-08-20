import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const PUBLIC_SUBMISSION_WHERE = {
  review_status: "approved",
  visibility: "public",
} as const;

export const PUBLIC_SUBMISSION_COUNT = {
  where: PUBLIC_SUBMISSION_WHERE,
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

const CORPUS_COLLECTION_MEDIA_TYPES = ["image", "video", "audio"] as const;
export type CorpusCollectionMediaType = (typeof CORPUS_COLLECTION_MEDIA_TYPES)[number];

export const ACTIVITY_TEXT_LIMITS = {
  title: 20,
  description: 100,
  rules: 100,
} as const;

export const ACTIVITY_TAG_LENGTH = 4;

function countCharacters(value: string) {
  return Array.from(value.trim()).length;
}

function parseLimitedActivityText(
  value: unknown,
  field: keyof typeof ACTIVITY_TEXT_LIMITS,
  options: { required?: boolean } = {}
) {
  if (value === undefined || value === null) {
    if (options.required) {
      throw new Error(`${field} is required`);
    }
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }

  const trimmed = value.trim();
  if (options.required && !trimmed) {
    throw new Error(`${field} is required`);
  }

  if (countCharacters(trimmed) > ACTIVITY_TEXT_LIMITS[field]) {
    throw new Error(`${field} must be ${ACTIVITY_TEXT_LIMITS[field]} characters or less`);
  }

  return trimmed;
}

export function parseActivityTextFields(
  body: Record<string, unknown>,
  options: { requireTitle?: boolean } = {}
) {
  return {
    title: parseLimitedActivityText(body.title, "title", { required: options.requireTitle }),
    description: parseLimitedActivityText(body.description, "description"),
    rules: parseLimitedActivityText(body.rules, "rules"),
  };
}

export function parseActivityTags(value: unknown, options: { required?: boolean } = {}) {
  if (value === undefined || value === null) {
    if (options.required) throw new Error("Activity tag is required");
    return undefined;
  }

  if (!Array.isArray(value) || value.length !== 1 || typeof value[0] !== "string") {
    throw new Error("Activity tag must be a single string");
  }

  const tag = value[0].trim();
  if (!tag) throw new Error("Activity tag is required");
  if (countCharacters(tag) !== ACTIVITY_TAG_LENGTH) {
    throw new Error(`Activity tag must be exactly ${ACTIVITY_TAG_LENGTH} characters`);
  }

  return [tag] as Prisma.InputJsonValue;
}

export function normalizeActivityMediaRequirements(value: unknown) {
  if (value && typeof value === "object") {
    const source = value as Record<string, any>;
    const requiredTypesSource = Array.isArray(source.requiredTypes)
      ? source.requiredTypes
      : Array.isArray(source.allowedTypes)
        ? source.allowedTypes
        : undefined;

    if (requiredTypesSource) {
      const requiredTypes = CORPUS_COLLECTION_MEDIA_TYPES.filter((type) =>
        requiredTypesSource.includes(type)
      );
      return { requiredTypes };
    }

    const requiredTypes = CORPUS_COLLECTION_MEDIA_TYPES.filter((type) => {
      const legacyKey = type === "image" ? "images" : type;
      const config = source[type] ?? source[legacyKey];
      return Boolean(config?.enabled ?? config?.required);
    });

    if (requiredTypes.length > 0) {
      return { requiredTypes };
    }
  }

  return { requiredTypes: ["image"] as CorpusCollectionMediaType[] };
}

export function parseActivityMediaRequirements(value: unknown) {
  const normalized = normalizeActivityMediaRequirements(value);
  if (normalized.requiredTypes.length < 1) {
    throw new Error("At least one media type is required");
  }
  return normalized as Prisma.InputJsonValue;
}

export function parseActivityWindow(startsAtValue: unknown, endsAtValue: unknown) {
  const startsAt =
    typeof startsAtValue === "string" && startsAtValue ? new Date(startsAtValue) : null;
  const endsAt = typeof endsAtValue === "string" && endsAtValue ? new Date(endsAtValue) : null;

  if (startsAt && Number.isNaN(startsAt.getTime())) {
    throw new Error("Invalid start time");
  }
  if (endsAt && Number.isNaN(endsAt.getTime())) {
    throw new Error("Invalid end time");
  }
  if (startsAt && endsAt && startsAt.getTime() >= endsAt.getTime()) {
    throw new Error("Start time must be earlier than end time");
  }

  return { startsAt, endsAt };
}

export function formatCompactCount(value: number | null | undefined) {
  const count = Number(value ?? 0);
  if (count >= 10000) return `${(count / 10000).toFixed(count >= 100000 ? 0 : 1)}万`;
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k`;
  return count.toString();
}

function getActivityTimeStatus(activity: {
  starts_at?: Date | null;
  ends_at?: Date | null;
}) {
  const now = Date.now();
  const startsAt = activity.starts_at?.getTime?.();
  const endsAt = activity.ends_at?.getTime?.();
  if (startsAt && startsAt > now) return "not_started";
  if (endsAt && endsAt < now) return "ended";
  return "ongoing";
}

function canSubmitToActivity(activity: {
  status?: string | null;
  starts_at?: Date | null;
  ends_at?: Date | null;
}) {
  return activity.status === "published" && getActivityTimeStatus(activity) === "ongoing";
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

function normalizeCoverUrl(value: unknown) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || null;
}

function getCoverMetadata(submission: any) {
  const cover = (submission.media ?? []).find((item: any) => item.media_type === "image");
  const metadata = cover?.metadata;
  const width = Number(metadata?.width);
  const height = Number(metadata?.height);

  return {
    coverUrl: submission.cover_url ?? cover?.url ?? null,
    coverWidth: Number.isFinite(width) && width > 0 ? width : null,
    coverHeight: Number.isFinite(height) && height > 0 ? height : null,
  };
}

export function serializeActivity(activity: any) {
  return {
    id: activity.id.toString(),
    displayUuid: activity.display_uuid,
    title: activity.title,
    slug: activity.slug,
    description: activity.description,
    rules: activity.rules,
    category: activity.category ?? null,
    tags: activity.tags ?? [],
    submissionTypes: activity.submission_types ?? [],
    rewardConfig: activity.reward_config,
    mediaRequirements: normalizeActivityMediaRequirements(activity.media_requirements),
    bannerUrl: activity.banner_url,
    status: activity.status,
    timeStatus: getActivityTimeStatus(activity),
    startsAt: activity.starts_at?.toISOString?.() ?? null,
    endsAt: activity.ends_at?.toISOString?.() ?? null,
    canSubmit: canSubmitToActivity(activity),
    submissionCount: activity._count?.submissions ?? activity.submissionCount ?? undefined,
    works: activity.submissions
      ? activity.submissions.map((item: any) => serializeSubmission(item))
      : undefined,
    createdAt: activity.created_at?.toISOString?.() ?? undefined,
    updatedAt: activity.updated_at?.toISOString?.() ?? undefined,
  };
}

export function serializePublicActivity(activity: any) {
  const serialized = serializeActivity(activity);
  return {
    ...serialized,
    works: activity.submissions
      ? activity.submissions.map((item: any) => serializePublicSubmission(item))
      : undefined,
  };
}

export function getSubmissionEditState(submission: any, viewerId?: string) {
  if (!viewerId || submission.user_id !== viewerId || submission.is_locked) {
    return { canEdit: false, editableUntil: null as string | null };
  }

  if (submission.is_awarded || submission.award_status === "awarded") {
    return { canEdit: false, editableUntil: null as string | null };
  }

  const editableUntilDate = submission.activity_id
    ? submission.activity?.ends_at ?? null
    : new Date(submission.created_at.getTime() + 24 * 60 * 60 * 1000);
  const editableUntil = editableUntilDate?.toISOString?.() ?? null;

  if (!editableUntilDate) {
    return { canEdit: true, editableUntil };
  }

  return {
    canEdit: editableUntilDate.getTime() > Date.now(),
    editableUntil,
  };
}

export function serializeSubmission(
  submission: any,
  viewerLiked?: boolean,
  viewerId?: string
) {
  const imageUrls = getSubmissionImages(submission);
  const editState = getSubmissionEditState(submission, viewerId);
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
    isAwarded: submission.is_awarded,
    awardStatus: submission.award_status,
    awardInfo: submission.award_info,
    coverUrl: submission.cover_url ?? imageUrls[0] ?? null,
    imageUrls,
    liked: viewerLiked,
    activity: submission.activity
      ? {
          id: submission.activity.id.toString(),
          displayUuid: submission.activity.display_uuid,
          title: submission.activity.title,
          startsAt: submission.activity.starts_at?.toISOString?.() ?? null,
          endsAt: submission.activity.ends_at?.toISOString?.() ?? null,
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
    ...editState,
    createdAt: submission.created_at?.toISOString?.() ?? undefined,
    updatedAt: submission.updated_at?.toISOString?.() ?? undefined,
  };
}

export function serializePublicSubmission(submission: any) {
  const serialized = serializeSubmission(submission);
  return {
    id: serialized.id,
    title: serialized.title,
    intro: serialized.intro,
    submissionType: serialized.submissionType,
    tags: serialized.tags,
    isFeatured: serialized.isFeatured,
    likeCount: serialized.likeCount,
    commentCount: serialized.commentCount,
    shareCount: serialized.shareCount,
    viewCount: serialized.viewCount,
    isAwarded: serialized.isAwarded,
    awardStatus: serialized.awardStatus,
    coverUrl: serialized.coverUrl,
    imageUrls: serialized.imageUrls,
    activity: serialized.activity,
    author: serialized.author,
    media: serialized.media,
    createdAt: serialized.createdAt,
    updatedAt: serialized.updatedAt,
  };
}

export function serializeHomeSubmission(submission: any) {
  const author = serializeUser(submission.user);
  const imageUrls = getSubmissionImages(submission);
  return {
    id: submission.id.toString(),
    imageUrl: submission.cover_url ?? imageUrls[0] ?? "",
    author: author?.name ?? "用户昵称",
    avatar: author?.avatar ?? "",
    viewCount: submission.view_count,
    isFeatured: submission.is_featured,
    showOnHome: submission.show_on_home,
  };
}

export function serializeHomeFeedSubmission(submission: any, viewerLiked?: boolean) {
  const author = serializeUser(submission.user);
  const imageUrls = getSubmissionImages(submission);
  const cover = getCoverMetadata(submission);
  const coverAspectRatio =
    cover.coverWidth && cover.coverHeight ? cover.coverWidth / cover.coverHeight : null;

  return {
    id: submission.id.toString(),
    title: submission.title,
    intro: submission.intro,
    submissionType: submission.submission_type,
    tags: submission.tags,
    coverUrl: cover.coverUrl ?? imageUrls[0] ?? "",
    imageUrls,
    coverWidth: cover.coverWidth,
    coverHeight: cover.coverHeight,
    coverAspectRatio,
    author: {
      id: author?.id ?? "",
      name: author?.name ?? "用户昵称",
      avatar: author?.avatar ?? "",
    },
    activity: submission.activity
      ? {
          id: submission.activity.id.toString(),
          displayUuid: submission.activity.display_uuid,
          title: submission.activity.title,
        }
      : null,
    likeCount: submission.like_count,
    commentCount: submission.comment_count,
    shareCount: submission.share_count,
    viewCount: submission.view_count,
    isFeatured: submission.is_featured,
    showOnHome: submission.show_on_home,
    liked: viewerLiked,
    createdAt: submission.created_at?.toISOString?.() ?? undefined,
  };
}

export const submissionInclude = {
  activity: { select: { id: true, display_uuid: true, title: true, starts_at: true, ends_at: true } },
  user: { select: { id: true, name: true, image: true, wechatAvatar: true } },
  media: { orderBy: { sort_order: "asc" } },
} satisfies Prisma.corpus_collection_submissionsInclude;

export function buildPublicSubmissionWhere(options: {
  activityId?: bigint | null;
  featured?: boolean;
  showOnHome?: boolean;
  type?: string | null;
  tag?: string | null;
  awardStatus?: string | null;
}) {
  return {
    ...PUBLIC_SUBMISSION_WHERE,
    OR: [{ activity_id: null }, { activity: { status: "published" } }],
    activity_id: options.activityId ?? undefined,
    is_featured: options.featured === undefined ? undefined : options.featured,
    show_on_home: options.showOnHome === undefined ? undefined : options.showOnHome,
    submission_type: options.type || undefined,
    award_status: options.awardStatus || undefined,
    tags: options.tag ? { array_contains: options.tag } : undefined,
  } satisfies Prisma.corpus_collection_submissionsWhereInput;
}

export function getPublicSubmissionOrderBy(sort?: "latest" | "likes" | "views") {
  if (sort === "likes") {
    return [
      { like_count: "desc" },
      { created_at: "desc" },
    ] satisfies Prisma.corpus_collection_submissionsOrderByWithRelationInput[];
  }

  if (sort === "views") {
    return [
      { view_count: "desc" },
      { created_at: "desc" },
    ] satisfies Prisma.corpus_collection_submissionsOrderByWithRelationInput[];
  }

  return {
    created_at: "desc",
  } satisfies Prisma.corpus_collection_submissionsOrderByWithRelationInput;
}

export async function listPublicSubmissions(options: {
  activityId?: bigint | null;
  featured?: boolean;
  showOnHome?: boolean;
  type?: string | null;
  tag?: string | null;
  awardStatus?: string | null;
  page: number;
  pageSize: number;
  sort?: "latest" | "likes" | "views";
  includeRaw?: boolean;
}) {
  const where = buildPublicSubmissionWhere(options);
  const [items, total] = await Promise.all([
    prisma.corpus_collection_submissions.findMany({
      where,
      include: submissionInclude,
      orderBy: getPublicSubmissionOrderBy(options.sort),
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
    }),
    prisma.corpus_collection_submissions.count({ where }),
  ]);

  return {
    items: items.map((item) => serializePublicSubmission(item)),
    ...(options.includeRaw ? { rawItems: items } : {}),
    pagination: { page: options.page, pageSize: options.pageSize, total },
  };
}

export async function listHomeFeedSubmissions(options: {
  activityId?: bigint | null;
  featured?: boolean;
  showOnHome?: boolean;
  type?: string | null;
  tag?: string | null;
  page: number;
  pageSize: number;
  sort?: "latest" | "likes" | "views";
  viewerId?: string;
}) {
  const where = buildPublicSubmissionWhere(options);
  const [items, total] = await Promise.all([
    prisma.corpus_collection_submissions.findMany({
      where,
      include: submissionInclude,
      orderBy: getPublicSubmissionOrderBy(options.sort),
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
    }),
    prisma.corpus_collection_submissions.count({ where }),
  ]);

  const likedSubmissionIds = new Set<bigint>();
  if (options.viewerId && items.length > 0) {
    const likes = await prisma.corpus_collection_likes.findMany({
      where: {
        user_id: options.viewerId,
        submission_id: { in: items.map((item) => item.id) },
      },
      select: { submission_id: true },
    });
    likes.forEach((like) => likedSubmissionIds.add(like.submission_id));
  }

  return {
    items: items.map((item) =>
      serializeHomeFeedSubmission(item, likedSubmissionIds.has(item.id))
    ),
    pagination: {
      page: options.page,
      pageSize: options.pageSize,
      total,
      hasMore: options.page * options.pageSize < total,
    },
  };
}

export function validateSubmissionMedia(media: unknown[], coverUrlValue?: unknown) {
  const images = media.filter((item: any) => item?.type === "image");
  const audios = media.filter((item: any) => item?.type === "audio");
  const videos = media.filter((item: any) => item?.type === "video");
  const coverUrl = normalizeCoverUrl(coverUrlValue);

  if (media.length < 1) return false;
  if (media.some((item: any) => !CORPUS_COLLECTION_MEDIA_TYPES.includes(item?.type))) {
    return false;
  }
  if (media.some((item: any) => typeof item?.url !== "string" || !item.url.trim())) {
    return false;
  }
  if (images.length > 8) return false;
  if (audios.length > 1) return false;
  if (videos.length > 1) return false;
  if (audios.some((item: any) => Number(item.durationSec ?? 0) > 60)) return false;
  if (videos.some((item: any) => Number(item.durationSec ?? 0) > 30)) return false;
  if (coverUrl === undefined) return false;
  return true;
}

function buildSubmissionMediaCreateInput(media: any[]) {
  return media.map((item: any, index: number) => ({
    media_type: item.type,
    url: item.url,
    duration_seconds:
      typeof item.durationSec === "number" ? Math.floor(item.durationSec) : null,
    sort_order: typeof item.sortOrder === "number" ? item.sortOrder : index,
    metadata: (item.metadata ?? {}) as Prisma.InputJsonValue,
  }));
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

  if (!validateSubmissionMedia(media, body.coverUrl)) {
    throw new Error("Invalid media requirements");
  }

  const activityId = parseBigIntId(body.activityId);
  const coverUrl = normalizeCoverUrl(body.coverUrl);

  return prisma.corpus_collection_submissions.create({
    data: {
      user_id: userId,
      activity_id: activityId,
      submission_type: body.submissionType,
      title: body.title,
      intro: body.intro,
      tags: body.tags as Prisma.InputJsonValue,
      cover_url: coverUrl ?? null,
      precheck_result: jsonInput(body.precheckResult),
      review_status: "pending_review",
      visibility: "private",
      media: {
        create: buildSubmissionMediaCreateInput(media),
      },
    },
    include: submissionInclude,
  });
}

export async function updateCorpusSubmission(userId: string, id: bigint, body: any) {
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

  if (!validateSubmissionMedia(media, body.coverUrl)) {
    throw new Error("Invalid media requirements");
  }

  const existing = await prisma.corpus_collection_submissions.findFirst({
    where: { id, user_id: userId },
    include: submissionInclude,
  });

  if (!existing) {
    throw new Error("Submission not found");
  }

  const editState = getSubmissionEditState(existing, userId);
  if (!editState.canEdit) {
    throw new Error("submission_edit_not_allowed");
  }

  return prisma.$transaction(async (tx) => {
    await tx.corpus_collection_submission_media.deleteMany({
      where: { submission_id: id },
    });

    return tx.corpus_collection_submissions.update({
      where: { id },
      data: {
        submission_type: body.submissionType,
        title: body.title,
        intro: body.intro,
        tags: body.tags as Prisma.InputJsonValue,
        cover_url: normalizeCoverUrl(body.coverUrl) ?? null,
        precheck_result: jsonInput(body.precheckResult),
        review_status: "pending_review",
        review_reason: null,
        visibility: "private",
        media: {
          create: buildSubmissionMediaCreateInput(media),
        },
      },
      include: submissionInclude,
    });
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
