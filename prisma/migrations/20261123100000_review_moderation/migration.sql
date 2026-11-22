-- Yorum moderasyonu: gizleme geri alinabilir, silme degil. Kolonlar bos
-- baslar; mevcut yorumlarin hepsi gorunur kalir.
ALTER TABLE "Review" ADD COLUMN "hiddenAt" TIMESTAMP(3);
ALTER TABLE "Review" ADD COLUMN "hiddenReason" TEXT;
ALTER TABLE "Review" ADD COLUMN "hiddenById" TEXT;

-- Yonetici "son yorumlar" listesi tarihe gore sayfalanir.
CREATE INDEX "Review_createdAt_idx" ON "Review"("createdAt");
