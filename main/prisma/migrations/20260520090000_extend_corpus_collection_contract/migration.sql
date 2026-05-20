ALTER TABLE "corpus_collection_activities"
ADD COLUMN "category" TEXT,
ADD COLUMN "tags" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "submission_types" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "corpus_collection_submissions"
ADD COLUMN "is_locked" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "corpus_collection_activities_category_idx" ON "corpus_collection_activities"("category");
CREATE INDEX "corpus_collection_submissions_is_locked_idx" ON "corpus_collection_submissions"("is_locked");

