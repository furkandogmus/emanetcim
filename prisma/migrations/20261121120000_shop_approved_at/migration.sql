-- Bekleyen basvuru ile pasife alinmis dukkani ayirmak icin onay zamani.
-- AlterTable
ALTER TABLE "Shop" ADD COLUMN "approvedAt" TIMESTAMP(3);

-- Mevcut kayitlar: aktif olan ya da herhangi bir rezervasyonu olan dukkan basvuru degildir.
UPDATE "Shop" s
SET "approvedAt" = s."createdAt"
WHERE s."isActive" = true
   OR EXISTS (SELECT 1 FROM "Booking" b WHERE b."shopId" = s."id");
