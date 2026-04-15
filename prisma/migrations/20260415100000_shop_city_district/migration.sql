-- AlterTable: Shop tablosuna city ve district sütunları ekle
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "district" TEXT;
