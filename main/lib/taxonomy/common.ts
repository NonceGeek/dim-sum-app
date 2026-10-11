import { Role, type Prisma, type PrismaClient } from "@prisma/client";

import { AppError } from "../app-error";

export function payload(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError(400, "Expected a JSON object");
  }
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new AppError(400, "Unknown request field");
  }
  return value as Record<string, unknown>;
}

export const MAX_NAME_LENGTH = 50;
export const MAX_GLOSS_LENGTH = 500;

export function parseName(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) {
    throw new AppError(400, "name must be a non-empty string");
  }
  const name = value.trim();
  if (name.length > MAX_NAME_LENGTH) throw new AppError(400, `name must be at most ${MAX_NAME_LENGTH} characters`);
  return name;
}

export function existingItem<T extends { status: string }>(rows: T[]): T | undefined {
  if (rows.length > 1) throw new AppError(409, "Multiple entries have this name");
  if (rows[0] && rows[0].status !== "active") throw new AppError(409, "Existing entry is inactive");
  return rows[0];
}

export function nameLockKey(kind: "category" | "tag", name: string, parentId: bigint | null = null) {
  return JSON.stringify([kind, parentId?.toString() ?? null, name]);
}

export async function advisoryXactLock(tx: Prisma.TransactionClient, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

const CREATOR_ROLES: Role[] = [Role.TAGGER_PARTNER, Role.TAGGER_OUTSOURCING, Role.RESEARCHER];

export async function assertCategoryTagCreator(db: PrismaClient, userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId }, select: { status: true, role: true, isSystemAdmin: true },
  });
  if (!user || user.status !== "ACTIVE" || (!user.isSystemAdmin && !CREATOR_ROLES.includes(user.role))) {
    throw new AppError(403, "Category/tag creation permission required");
  }
}

export async function createTransaction<T>(db: PrismaClient, operation: (tx: Prisma.TransactionClient) => Promise<T>) {
  try {
    // The lookup after waiting for the lock must see the previous writer's commit.
    return await db.$transaction(operation, { isolationLevel: "ReadCommitted" });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      throw new AppError(409, "Category/tag uniqueness conflict");
    }
    throw error;
  }
}

