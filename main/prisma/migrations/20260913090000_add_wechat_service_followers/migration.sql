CREATE TABLE "WechatServiceFollower" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "openId" TEXT NOT NULL,
    "unionId" TEXT,
    "subscribed" BOOLEAN NOT NULL DEFAULT false,
    "eventTime" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "needsSync" BOOLEAN NOT NULL DEFAULT true,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WechatServiceFollower_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WechatServiceFollower_appId_openId_key" ON "WechatServiceFollower"("appId", "openId");
CREATE INDEX "WechatServiceFollower_appId_unionId_idx" ON "WechatServiceFollower"("appId", "unionId");
CREATE INDEX "WechatServiceFollower_appId_needsSync_idx" ON "WechatServiceFollower"("appId", "needsSync");
