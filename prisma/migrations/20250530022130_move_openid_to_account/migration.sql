/*
  Warnings:

  - You are about to drop the column `openId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `unionId` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "User_openId_key";

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "openId" TEXT,
ADD COLUMN     "unionId" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "openId",
DROP COLUMN "unionId";

-- CreateIndex
CREATE INDEX "Account_openId_idx" ON "Account"("openId");
