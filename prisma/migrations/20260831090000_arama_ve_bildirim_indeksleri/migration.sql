-- AlterTable
ALTER TABLE "NotificationLog" ADD COLUMN     "providerMessageId" TEXT;

-- CreateIndex
CREATE INDEX "Booking_guestEmail_idx" ON "Booking"("guestEmail");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_providerMessageId_key" ON "NotificationLog"("providerMessageId");

