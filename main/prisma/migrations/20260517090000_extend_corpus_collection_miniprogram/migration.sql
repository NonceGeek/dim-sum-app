-- AlterTable
ALTER TABLE "corpus_collection_submissions"
ADD COLUMN "view_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "is_awarded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "award_status" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN "award_info" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "corpus_collection_messages" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "submission_id" BIGINT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corpus_collection_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "corpus_collection_submissions_is_awarded_award_status_idx" ON "corpus_collection_submissions"("is_awarded", "award_status");
CREATE INDEX "corpus_collection_messages_user_id_is_read_created_at_idx" ON "corpus_collection_messages"("user_id", "is_read", "created_at");
CREATE INDEX "corpus_collection_messages_submission_id_idx" ON "corpus_collection_messages"("submission_id");

-- AddForeignKey
ALTER TABLE "corpus_collection_messages" ADD CONSTRAINT "corpus_collection_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "corpus_collection_messages" ADD CONSTRAINT "corpus_collection_messages_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "corpus_collection_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
