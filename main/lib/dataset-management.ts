import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";

export type ContentAttribute = "oral" | "cultural_knowledge";

export function parseContentAttribute(value: unknown): ContentAttribute {
  if (value !== "oral" && value !== "cultural_knowledge") {
    throw new Error("Choose oral or cultural_knowledge for the dataset");
  }
  return value;
}

export function parseDatasetUpdate(body: Record<string, unknown>) {
  const data: { nickname?: string; description?: string; content_attribute?: ContentAttribute; is_public?: boolean } = {};
  for (const [key, max] of [["nickname", 100], ["description", 2000]] as const) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== "string") throw new Error(`Invalid ${key}`);
    const value = body[key].trim();
    if ((key === "nickname" && !value) || Array.from(value).length > max) throw new Error(`Invalid ${key}`);
    data[key] = value;
  }
  if (body.contentAttribute !== undefined) data.content_attribute = parseContentAttribute(body.contentAttribute);
  if (body.is_public !== undefined) {
    if (typeof body.is_public !== "boolean") throw new Error("Invalid is_public");
    data.is_public = body.is_public;
  }
  if (!Object.keys(data).length) throw new Error("No dataset changes supplied");
  return data;
}

export class ActivityCreationConflict extends Error {}

function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]),
  );
  return value;
}

export async function createActivityWithDataset(
  client: PrismaClient,
  data: Omit<Prisma.corpus_collection_activitiesUncheckedCreateInput, "dataset_name">,
  contentAttribute: ContentAttribute,
  creationKey: string,
) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(creationKey)) throw new Error("Invalid creation key");
  const key = creationKey.toLowerCase();
  const hash = createHash("sha256").update(JSON.stringify(canonical({ data, contentAttribute }))).digest("hex");
  return client.$transaction(async (tx) => {
    // Serialize retries before creating either row, including requests racing each other.
    await tx.$queryRaw`select pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
    const existing = await tx.corpus_collection_activities.findUnique({ where: { creation_key: key }, include: { dataset: true } });
    if (existing) {
      if (existing.creation_hash !== hash) throw new ActivityCreationConflict("Creation key was already used with different activity details");
      return { activity: existing, replayed: true };
    }
    const dataset = await tx.cantonese_categories.create({ data: {
      name: `activity-${key}`,
      nickname: data.title,
      description: typeof data.description === "string" ? data.description : null,
      content_attribute: contentAttribute,
      // Creating a dataset is not a publication decision.
      is_public: false,
      if_in_all_data: false,
    } });
    const activity = await tx.corpus_collection_activities.create({
      data: { ...data, dataset_name: dataset.name, creation_key: key, creation_hash: hash },
      include: { dataset: true },
    });
    return { activity, replayed: false };
  });
}
