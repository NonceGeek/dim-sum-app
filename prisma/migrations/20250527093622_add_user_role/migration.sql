-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'MARKER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';
