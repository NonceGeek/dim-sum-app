import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Public scope shared with Web; independent of the daily/legacy oral eligibility. */
export async function isPublicEntry(id: string, db: Pick<Prisma.TransactionClient, "$queryRaw"> = prisma) {
  const rows = await db.$queryRaw<Array<{ available: boolean }>>`
    SELECT EXISTS(SELECT 1 FROM cantonese_corpus_all c
      JOIN cantonese_categories d ON d.name=c.category
      WHERE c.unique_id=${id}::uuid AND d.is_public=true) AS available
  `;
  return rows[0]?.available === true;
}
