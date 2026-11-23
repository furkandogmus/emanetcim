-- Uygulama tanitimi: magaza yayin bayraklari (varsayilan kapali, site bugunku gibi kalir)
-- ve /app isabet defteri (kisisel veri yok). Yalnizca ekleme.
-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN "iosAppStoreLive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "androidPlayLive" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AppLinkHit" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppLinkHit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppLinkHit_createdAt_idx" ON "AppLinkHit"("createdAt");
