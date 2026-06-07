ALTER TABLE "corpus_collection_activities"
ADD COLUMN "display_uuid" UUID;

UPDATE "corpus_collection_activities"
SET "display_uuid" = gen_random_uuid()
WHERE "display_uuid" IS NULL;

ALTER TABLE "corpus_collection_activities"
ALTER COLUMN "display_uuid" SET DEFAULT gen_random_uuid(),
ALTER COLUMN "display_uuid" SET NOT NULL;

CREATE UNIQUE INDEX "corpus_collection_activities_display_uuid_key"
ON "corpus_collection_activities"("display_uuid");
