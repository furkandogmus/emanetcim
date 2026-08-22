-- Yaşam döngüsü: PLANLANAN pencere ile GERÇEKLEŞEN zamanları ayır.
--
-- P1-10 (2026-08-22 denetimi): `checkOut()` `checkOutTime` alanına `now` yazıyordu,
-- yani REZERVE edilen bitiş zamanı yok oluyordu. Gecikme ücreti ve erken iade
-- ikisi de bu alandan hesaplandığı için, çıkıştan sonra faturanın girdileri
-- yeniden kurulamıyordu. Gerçek geçişler yalnızca `BookingEvent`'te vardı.

ALTER TABLE "Booking"
  ADD COLUMN "checkedInAt"  TIMESTAMP(3),
  ADD COLUMN "checkedOutAt" TIMESTAMP(3);

-- Geçmiş kayıtlar için gerçek geçiş anları `BookingEvent`'ten geri kazanılıyor.
-- Bu tek güvenilir kaynak: `checkOutTime` üzerine yazılmış olabilir, olay kaydı ise
-- append-only. Olay yoksa NULL kalır — uydurmuyoruz.
UPDATE "Booking" b
SET "checkedInAt" = e."firstAt"
FROM (
  SELECT "bookingId", MIN("createdAt") AS "firstAt"
  FROM "BookingEvent" WHERE event = 'CHECKED_IN' GROUP BY "bookingId"
) e
WHERE e."bookingId" = b.id;

UPDATE "Booking" b
SET "checkedOutAt" = e."firstAt"
FROM (
  SELECT "bookingId", MIN("createdAt") AS "firstAt"
  FROM "BookingEvent" WHERE event = 'CHECKED_OUT' GROUP BY "bookingId"
) e
WHERE e."bookingId" = b.id;

CREATE INDEX "Booking_status_checkedOutAt_idx" ON "Booking"("status", "checkedOutAt");
