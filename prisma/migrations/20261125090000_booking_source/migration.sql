-- Rezervasyon kanali (web/app/walk_in/poster), afis atfinin dukkani ve kapidan gelen misafirin adi.
-- Ekleyici; mevcut satirlar NULL kalir (kanal bilinmiyor).
ALTER TABLE "Booking" ADD COLUMN "source" TEXT;
ALTER TABLE "Booking" ADD COLUMN "sourceShopId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "guestName" TEXT;

-- CreateIndex
CREATE INDEX "Booking_source_createdAt_idx" ON "Booking"("source", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_sourceShopId_source_createdAt_idx" ON "Booking"("sourceShopId", "source", "createdAt");
