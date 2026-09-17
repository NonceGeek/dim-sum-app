import { CorpusPermission } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkCorpusPermission } from "@/lib/permission";

export const CORPUS_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const EDITOR_CACHE_HEADERS = { "Cache-Control": "private, no-store" };

export class CorpusEditAccessError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function requireCorpusEditor(userId: string | undefined, category: string) {
  if (!userId) throw new CorpusEditAccessError(401, "Authentication required");
  // Read current privileges so revoked roles and disabled accounts take effect.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isSystemAdmin: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") throw new CorpusEditAccessError(403, "Permission denied");
  const permission = await checkCorpusPermission(user, category, CorpusPermission.WRITE);
  if (!permission.allowed) throw new CorpusEditAccessError(403, "Permission denied");
}

export async function getCorpusItemForEditing(userId: string | undefined, uniqueId: string) {
  if (!userId) throw new CorpusEditAccessError(401, "Authentication required");
  if (!CORPUS_UUID_PATTERN.test(uniqueId)) throw new CorpusEditAccessError(400, "Invalid corpus id");
  const item = await prisma.cantonese_corpus_all.findUnique({
    where: { unique_id: uniqueId },
    include: { cantonese_categories: { select: { nickname: true, editable_level: true } } },
  });
  if (!item) throw new CorpusEditAccessError(404, "Corpus item not found");
  // Never trust a caller-supplied category when authorizing access to an item.
  await requireCorpusEditor(userId, item.category);
  return item;
}
