-- Guest checkout: email/phone ile accountsız booking
-- guestId artık nullable, guestEmail ve guestPhone alanları eklendi

ALTER TABLE "Booking" ALTER COLUMN "guestId" DROP NOT NULL;
ALTER TABLE "Booking" ADD COLUMN "guestEmail" TEXT;
ALTER TABLE "Booking" ADD COLUMN "guestPhone" TEXT;
CREATE INDEX IF NOT EXISTS "Booking_guestEmail_idx" ON "Booking"("guestEmail");
