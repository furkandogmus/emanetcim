-- AlterTable: Shop tablosuna güven & güvenilirlik alanları ekle
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "responseTimeMinutes" INTEGER DEFAULT 0;
