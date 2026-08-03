ALTER TABLE "User"
ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User"
SET "isSuperAdmin" = true,
    "isSystemAdmin" = true
WHERE "email" = '0xfynnix@gmail.com';
