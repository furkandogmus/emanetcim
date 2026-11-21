-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Booking_guestId_idempotencyKey_key" ON "Booking"("guestId", "idempotencyKey");
