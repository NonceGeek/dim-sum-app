import type { Prisma } from "@prisma/client";

/** Called inside the account-merge transaction, after both users are locked and snapshotted. */
export async function mergeApplicationFavorites(
  tx: Prisma.TransactionClient,
  sourceUserId: string,
  targetUserId: string,
  favorites: Array<{ app_id: bigint; created_at: Date }>,
) {
  if (sourceUserId === targetUserId)
    throw new Error("Cannot merge a user into itself");
  for (const f of favorites) {
    await tx.app_store_favorites.upsert({
      where: { user_id_app_id: { user_id: targetUserId, app_id: f.app_id } },
      create: {
        user_id: targetUserId,
        app_id: f.app_id,
        created_at: f.created_at,
      },
      update: {},
    });
  }
  await tx.app_store_favorites.deleteMany({ where: { user_id: sourceUserId } });
}
