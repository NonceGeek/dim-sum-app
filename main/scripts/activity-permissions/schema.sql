-- #479 schema reference and isolated test fixture; not a production deployment command.
-- Production was synchronized via db pull -> merge -> db push, with RLS applied separately.
-- Do not rerun this non-idempotent script on the synchronized database.
BEGIN;

-- DropForeignKey
ALTER TABLE "corpus_collection_audit_logs" DROP CONSTRAINT "corpus_collection_audit_logs_operator_id_fkey";

-- AlterTable
ALTER TABLE "corpus_collection_activity_permissions" ADD COLUMN     "submission_actions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "submission_note" TEXT,
ALTER COLUMN "can_view_insights" SET DEFAULT false;

-- AlterTable
ALTER TABLE "corpus_collection_audit_logs" ADD COLUMN     "after_state" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "before_state" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "note" TEXT,
ADD COLUMN     "operator_role" TEXT,
ADD COLUMN     "outcome" TEXT NOT NULL DEFAULT 'success',
ADD COLUMN     "submission_id" BIGINT;

-- CreateTable
CREATE TABLE "corpus_collection_operator_roles" (
    "user_id" TEXT NOT NULL,
    "role_code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "assigned_by" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corpus_collection_operator_roles_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "corpus_collection_operator_roles" ADD CONSTRAINT "corpus_collection_operator_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- No public API policies: access is enforced by the server connection.
ALTER TABLE "corpus_collection_operator_roles" ENABLE ROW LEVEL SECURITY;

COMMIT;
