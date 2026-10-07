import { NextRequest, NextResponse } from "next/server";
import { PermissionAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logPermissionChange } from "@/lib/permission";
import {
  DATASET_ACCESS_MODES,
  DATASET_MODALITIES,
  DATASET_USE_CASES,
} from "@/lib/library/options";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);
const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .nullish()
  .transform((v) => v || null)
  .refine((v) => !v || /^https?:\/\//i.test(v), "链接需以 http(s):// 开头");

const schema = z.object({
  name: z.string().min(1).max(200),
  listed: z.boolean(),
  enName: optional(200),
  modalities: z.array(z.enum(DATASET_MODALITIES)).max(4),
  useCases: z.array(z.enum(DATASET_USE_CASES)).max(4),
  accessMode: z.enum(DATASET_ACCESS_MODES),
  isOfficial: z.boolean(),
  metadataVerified: z.boolean(),
  scaleSummary: optional(200),
  languageScope: optional(200),
  usageNotes: optional(5000),
  cover: httpUrl,
  link: httpUrl,
  tags: z.array(z.string().trim().min(1).max(40)).max(12),
});

async function requireAdmin() {
  const session = await getAuthSession();
  return session?.user?.isSystemAdmin ? session.user.id! : null;
}

function serialize(
  category: {
    name: string;
    nickname: string | null;
    cover: string | null;
    link: string | null;
    tags: unknown;
  },
  profile: Awaited<ReturnType<typeof prisma.library_dataset_profiles.findUnique>>,
) {
  return {
    name: category.name,
    nickname: category.nickname,
    listed: profile?.listed ?? false,
    enName: profile?.en_name ?? null,
    modalities: profile?.modalities ?? [],
    useCases: profile?.use_cases ?? [],
    accessMode: profile?.access_mode ?? "metadata_only",
    isOfficial: profile?.is_official ?? false,
    metadataVerified: profile?.metadata_verified ?? false,
    scaleSummary: profile?.scale_summary ?? null,
    languageScope: profile?.language_scope ?? null,
    usageNotes: profile?.usage_notes ?? null,
    cover: category.cover,
    link: category.link,
    tags: Array.isArray(category.tags)
      ? category.tags.filter((t) => typeof t === "string")
      : [],
  };
}

/** GET /api/admin/library-profiles?name= — Library display fields of one dataset. */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const name = new URL(req.url).searchParams.get("name") ?? "";
  const category = await prisma.cantonese_categories.findUnique({
    where: { name },
    select: { name: true, nickname: true, cover: true, link: true, tags: true },
  });
  if (!category)
    return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
  const profile = await prisma.library_dataset_profiles.findUnique({
    where: { dataset_name: name },
  });
  return NextResponse.json(serialize(category, profile), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function PUT(req: NextRequest) {
  const operatorId = await requireAdmin();
  if (!operatorId)
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 },
    );
  const input = parsed.data;
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`select name from cantonese_categories where name = ${input.name} for update`;
    const category = await tx.cantonese_categories.findUnique({
      where: { name: input.name },
      select: { name: true, nickname: true, cover: true, link: true, tags: true },
    });
    if (!category) return null;
    const before = serialize(
      category,
      await tx.library_dataset_profiles.findUnique({
        where: { dataset_name: input.name },
      }),
    );
    const profileData = {
      listed: input.listed,
      en_name: input.enName,
      modalities: input.modalities,
      use_cases: input.useCases,
      access_mode: input.accessMode,
      is_official: input.isOfficial,
      metadata_verified: input.metadataVerified,
      scale_summary: input.scaleSummary,
      language_scope: input.languageScope,
      usage_notes: input.usageNotes,
      updated_by: operatorId,
    };
    const profile = await tx.library_dataset_profiles.upsert({
      where: { dataset_name: input.name },
      create: { dataset_name: input.name, ...profileData },
      update: profileData,
    });
    const nextCategory = await tx.cantonese_categories.update({
      where: { name: input.name },
      data: {
        cover: input.cover,
        link: input.link,
        tags: input.tags,
        updated_at: new Date(),
      },
      select: { name: true, nickname: true, cover: true, link: true, tags: true },
    });
    const after = serialize(nextCategory, profile);
    await logPermissionChange(
      {
        operatorId,
        targetUserId: operatorId,
        action: PermissionAction.MODIFY,
        categoryName: input.name,
        oldValue: { library: before },
        newValue: { library: after },
      },
      tx,
    );
    return after;
  });
  if (!result)
    return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
  revalidatePath("/[locale]/(home)/library", "page");
  revalidatePath("/[locale]/(home)/library/datasets/[slug]", "page");
  return NextResponse.json(result);
}
