-- CreateTable
CREATE TABLE "game_cloze_questions" (
    "id" BIGSERIAL NOT NULL,
    "external_id" TEXT NOT NULL,
    "scene" TEXT NOT NULL,
    "source_corpus_unique_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "batch_tag" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_cloze_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_answer_records" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "question_id" TEXT,
    "scene" TEXT,
    "selected_answer" TEXT,
    "selected_index" INTEGER,
    "is_correct" BOOLEAN,
    "time_spent_seconds" INTEGER,
    "audio_url" TEXT,
    "image_url" TEXT,
    "score" INTEGER,
    "agent_result" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_answer_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_player_progress" (
    "user_id" TEXT NOT NULL,
    "total_time_seconds" INTEGER NOT NULL DEFAULT 0,
    "completed_questions" INTEGER NOT NULL DEFAULT 0,
    "correct_questions" INTEGER NOT NULL DEFAULT 0,
    "graded_questions" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "level" TEXT NOT NULL DEFAULT 'beginner',
    "current_streak_days" INTEGER NOT NULL DEFAULT 0,
    "last_played_date" DATE,
    "context_completed" INTEGER NOT NULL DEFAULT 0,
    "sound_completed" INTEGER NOT NULL DEFAULT 0,
    "image_completed" INTEGER NOT NULL DEFAULT 0,
    "context_correct" INTEGER NOT NULL DEFAULT 0,
    "sound_correct" INTEGER NOT NULL DEFAULT 0,
    "image_correct" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_player_progress_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_cloze_questions_external_id_key" ON "game_cloze_questions"("external_id");

-- CreateIndex
CREATE INDEX "idx_game_cloze_questions_scene_active" ON "game_cloze_questions"("scene") WHERE "status" = 'active';

-- CreateIndex
CREATE INDEX "game_answer_records_user_id_mode_created_at_idx" ON "game_answer_records"("user_id", "mode", "created_at");

-- CreateIndex
CREATE INDEX "game_answer_records_question_id_idx" ON "game_answer_records"("question_id");

-- CreateIndex
CREATE INDEX "game_answer_records_created_at_idx" ON "game_answer_records"("created_at");

-- AddForeignKey
ALTER TABLE "game_answer_records" ADD CONSTRAINT "game_answer_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_player_progress" ADD CONSTRAINT "game_player_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
