-- CreateTable
CREATE TABLE "corpus_collection_activities" (
    "id" BIGSERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "rules" TEXT,
    "reward_config" JSONB NOT NULL DEFAULT '{}',
    "media_requirements" JSONB NOT NULL DEFAULT '{}',
    "banner_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corpus_collection_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corpus_collection_categories" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'tag',
    "status" TEXT NOT NULL DEFAULT 'active',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corpus_collection_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corpus_collection_submissions" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "activity_id" BIGINT,
    "submission_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "intro" TEXT NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "review_status" TEXT NOT NULL DEFAULT 'pending_review',
    "precheck_result" JSONB,
    "ai_review_result" JSONB,
    "review_reason" TEXT,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "show_on_home" BOOLEAN NOT NULL DEFAULT false,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "share_count" INTEGER NOT NULL DEFAULT 0,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corpus_collection_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corpus_collection_submission_media" (
    "id" BIGSERIAL NOT NULL,
    "submission_id" BIGINT NOT NULL,
    "media_type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "duration_seconds" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corpus_collection_submission_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corpus_collection_likes" (
    "id" BIGSERIAL NOT NULL,
    "submission_id" BIGINT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corpus_collection_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corpus_collection_comments" (
    "id" BIGSERIAL NOT NULL,
    "submission_id" BIGINT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corpus_collection_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corpus_collection_review_batches" (
    "id" BIGSERIAL NOT NULL,
    "batch_external_id" TEXT NOT NULL,
    "agent_batch_id" TEXT,
    "activity_id" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "context" JSONB NOT NULL DEFAULT '{}',
    "submission_count" INTEGER NOT NULL DEFAULT 0,
    "progress" JSONB NOT NULL DEFAULT '{}',
    "failure_reason" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "corpus_collection_review_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corpus_collection_review_batch_items" (
    "id" BIGSERIAL NOT NULL,
    "batch_id" BIGINT NOT NULL,
    "submission_id" BIGINT NOT NULL,
    "submission_external_id" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "result" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corpus_collection_review_batch_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corpus_collection_review_events" (
    "id" BIGSERIAL NOT NULL,
    "event_id" TEXT NOT NULL,
    "batch_id" BIGINT,
    "submission_id" BIGINT,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corpus_collection_review_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "corpus_collection_activities_slug_key" ON "corpus_collection_activities"("slug");
CREATE INDEX "corpus_collection_activities_status_starts_at_ends_at_idx" ON "corpus_collection_activities"("status", "starts_at", "ends_at");
CREATE INDEX "corpus_collection_activities_created_at_idx" ON "corpus_collection_activities"("created_at");
CREATE UNIQUE INDEX "corpus_collection_categories_name_type_key" ON "corpus_collection_categories"("name", "type");
CREATE INDEX "corpus_collection_categories_status_sort_order_idx" ON "corpus_collection_categories"("status", "sort_order");
CREATE INDEX "corpus_collection_submissions_user_id_created_at_idx" ON "corpus_collection_submissions"("user_id", "created_at");
CREATE INDEX "corpus_collection_submissions_activity_id_review_status_idx" ON "corpus_collection_submissions"("activity_id", "review_status");
CREATE INDEX "corpus_collection_submissions_review_status_created_at_idx" ON "corpus_collection_submissions"("review_status", "created_at");
CREATE INDEX "corpus_collection_submissions_is_featured_show_on_home_idx" ON "corpus_collection_submissions"("is_featured", "show_on_home");
CREATE INDEX "corpus_collection_submission_media_submission_id_sort_order_idx" ON "corpus_collection_submission_media"("submission_id", "sort_order");
CREATE UNIQUE INDEX "corpus_collection_likes_submission_id_user_id_key" ON "corpus_collection_likes"("submission_id", "user_id");
CREATE INDEX "corpus_collection_likes_user_id_idx" ON "corpus_collection_likes"("user_id");
CREATE INDEX "corpus_collection_comments_submission_id_status_created_at_idx" ON "corpus_collection_comments"("submission_id", "status", "created_at");
CREATE INDEX "corpus_collection_comments_user_id_idx" ON "corpus_collection_comments"("user_id");
CREATE UNIQUE INDEX "corpus_collection_review_batches_batch_external_id_key" ON "corpus_collection_review_batches"("batch_external_id");
CREATE INDEX "corpus_collection_review_batches_status_created_at_idx" ON "corpus_collection_review_batches"("status", "created_at");
CREATE INDEX "corpus_collection_review_batches_agent_batch_id_idx" ON "corpus_collection_review_batches"("agent_batch_id");
CREATE UNIQUE INDEX "corpus_collection_review_batch_items_batch_id_submission_external_id_key" ON "corpus_collection_review_batch_items"("batch_id", "submission_external_id");
CREATE UNIQUE INDEX "corpus_collection_review_batch_items_batch_id_submission_id_key" ON "corpus_collection_review_batch_items"("batch_id", "submission_id");
CREATE INDEX "corpus_collection_review_batch_items_submission_id_idx" ON "corpus_collection_review_batch_items"("submission_id");
CREATE INDEX "corpus_collection_review_batch_items_status_idx" ON "corpus_collection_review_batch_items"("status");
CREATE UNIQUE INDEX "corpus_collection_review_events_event_id_key" ON "corpus_collection_review_events"("event_id");
CREATE INDEX "corpus_collection_review_events_batch_id_created_at_idx" ON "corpus_collection_review_events"("batch_id", "created_at");
CREATE INDEX "corpus_collection_review_events_submission_id_idx" ON "corpus_collection_review_events"("submission_id");

-- AddForeignKey
ALTER TABLE "corpus_collection_activities" ADD CONSTRAINT "corpus_collection_activities_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "corpus_collection_submissions" ADD CONSTRAINT "corpus_collection_submissions_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "corpus_collection_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "corpus_collection_submissions" ADD CONSTRAINT "corpus_collection_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "corpus_collection_submissions" ADD CONSTRAINT "corpus_collection_submissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "corpus_collection_submission_media" ADD CONSTRAINT "corpus_collection_submission_media_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "corpus_collection_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "corpus_collection_likes" ADD CONSTRAINT "corpus_collection_likes_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "corpus_collection_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "corpus_collection_likes" ADD CONSTRAINT "corpus_collection_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "corpus_collection_comments" ADD CONSTRAINT "corpus_collection_comments_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "corpus_collection_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "corpus_collection_comments" ADD CONSTRAINT "corpus_collection_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "corpus_collection_review_batches" ADD CONSTRAINT "corpus_collection_review_batches_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "corpus_collection_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "corpus_collection_review_batches" ADD CONSTRAINT "corpus_collection_review_batches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "corpus_collection_review_batch_items" ADD CONSTRAINT "corpus_collection_review_batch_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "corpus_collection_review_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "corpus_collection_review_batch_items" ADD CONSTRAINT "corpus_collection_review_batch_items_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "corpus_collection_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "corpus_collection_review_events" ADD CONSTRAINT "corpus_collection_review_events_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "corpus_collection_review_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
