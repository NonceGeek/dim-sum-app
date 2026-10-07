import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AccessError } from "@/lib/services/submission-access";
import {
  PRIVATE_HEADERS,
  requireCapability,
  withLibraryOps,
} from "@/lib/library/ops-access";
import { userNames } from "@/lib/library/contribution-service";

export async function GET(req: NextRequest) {
  return withLibraryOps(req, async (access) => {
    requireCapability(access, "contribution_review");
    const params = new URL(req.url).searchParams;
    const status = params.get("status");
    const page = Math.max(1, Number(params.get("page")) || 1);
    const pageSize = 20;
    const where = status === "OPEN" || status === "HANDLED" ? { status } : {};
    const [rows, total] = await prisma.$transaction([
      prisma.dataset_contact_requests.findMany({
        where,
        orderBy: [{ status: "desc" }, { created_at: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.dataset_contact_requests.count({ where }),
    ]);
    const datasets = await prisma.cantonese_categories.findMany({
      where: { name: { in: [...new Set(rows.map((r) => r.dataset_name))] } },
      select: { name: true, nickname: true },
    });
    const names = await userNames(rows.map((r) => r.handled_by));
    return NextResponse.json(
      {
        items: rows.map((r) => ({
          id: String(r.id),
          datasetSlug: r.dataset_name,
          datasetName:
            datasets.find((d) => d.name === r.dataset_name)?.nickname ?? r.dataset_name,
          requestType: r.request_type,
          contactName: r.contact_name,
          contactEmail: r.contact_email,
          organizationName: r.organization_name,
          message: r.message,
          status: r.status,
          handledByName: r.handled_by ? (names[r.handled_by] ?? r.handled_by) : null,
          handledNote: r.handled_note,
          handledAt: r.handled_at?.toISOString() ?? null,
          createdAt: r.created_at.toISOString(),
        })),
        total,
        page,
        pageSize,
      },
      { headers: PRIVATE_HEADERS },
    );
  });
}

const patchSchema = z.object({
  id: z.string().regex(/^\d+$/),
  status: z.enum(["OPEN", "HANDLED"]),
  note: z.string().trim().max(2000).optional(),
});

export async function PATCH(req: NextRequest) {
  return withLibraryOps(req, async (access) => {
    requireCapability(access, "contribution_review");
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new AccessError(400, "参数无效");
    const handled = parsed.data.status === "HANDLED";
    const existing = await prisma.dataset_contact_requests.findUnique({
      where: { id: BigInt(parsed.data.id) },
      select: { id: true },
    });
    if (!existing) throw new AccessError(404, "记录不存在");
    const updated = await prisma.dataset_contact_requests.update({
      where: { id: BigInt(parsed.data.id) },
      data: {
        status: parsed.data.status,
        handled_by: handled ? access.userId : null,
        handled_at: handled ? new Date() : null,
        handled_note: handled ? (parsed.data.note ?? null) : null,
      },
    });
    return NextResponse.json(
      { id: String(updated.id), status: updated.status },
      { headers: PRIVATE_HEADERS },
    );
  });
}
