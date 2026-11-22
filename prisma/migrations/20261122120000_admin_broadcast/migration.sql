-- Yonetici duyuru (operasyonel push yayini) kaydi. Ekleyici: yeni iki enum ve bir tablo; mevcut veriye dokunmaz.
-- CreateEnum
CREATE TYPE "BroadcastAudience" AS ENUM ('PARTNERS', 'GUESTS', 'ALL');

-- CreateEnum
CREATE TYPE "BroadcastStatus" AS ENUM ('QUEUED', 'SENDING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL,
    "audience" "BroadcastAudience" NOT NULL,
    "titleTr" TEXT NOT NULL,
    "bodyTr" TEXT NOT NULL,
    "titleEn" TEXT,
    "bodyEn" TEXT,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "targetedDevices" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "status" "BroadcastStatus" NOT NULL DEFAULT 'QUEUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Broadcast_createdAt_idx" ON "Broadcast"("createdAt");

-- CreateIndex
CREATE INDEX "Broadcast_status_idx" ON "Broadcast"("status");

