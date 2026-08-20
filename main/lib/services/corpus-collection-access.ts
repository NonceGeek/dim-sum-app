import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type CorpusCollectionAccess = {
  userId: string;
  isSystemAdmin: boolean;
  activityIds: bigint[] | null;
  canExport: boolean;
};

export async function getCorpusCollectionAccess(): Promise<CorpusCollectionAccess | null> {
  const session = await getAuthSession();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isSystemAdmin: true, isSuperAdmin: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") return null;
  if (user.isSystemAdmin || user.isSuperAdmin) {
    return {
      userId: session.user.id,
      isSystemAdmin: true,
      activityIds: null,
      canExport: true,
    };
  }
  const permissions = await prisma.corpus_collection_activity_permissions.findMany({
    where: { user_id: session.user.id, can_view_insights: true },
    select: { activity_id: true, can_export_insights: true },
  });
  if (!permissions.length) return null;
  return {
    userId: session.user.id,
    isSystemAdmin: false,
    activityIds: permissions.map((permission) => permission.activity_id),
    canExport: permissions.some((permission) => permission.can_export_insights),
  };
}

export async function requireCorpusCollectionAccess(
  req: NextRequest,
  handler: (req: NextRequest, access: CorpusCollectionAccess) => Promise<NextResponse>,
) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const access = await getCorpusCollectionAccess();
  if (!access) {
    return NextResponse.json({ error: "Corpus Collection access required" }, { status: 403 });
  }
  return handler(req, access);
}

export function assertActivityAccess(access: CorpusCollectionAccess, activityId: bigint | null) {
  if (activityId && access.activityIds && !access.activityIds.includes(activityId)) {
    throw new Error("ACTIVITY_ACCESS_DENIED");
  }
}
