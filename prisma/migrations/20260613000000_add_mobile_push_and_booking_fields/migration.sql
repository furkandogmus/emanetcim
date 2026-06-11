-- MobilePushToken tablosu (schema'da var, DB'de yok)
CREATE TABLE IF NOT EXISTS "MobilePushToken" (
    "token"      TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "platform"   TEXT NOT NULL,
    "appVersion" TEXT,
    "locale"     TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MobilePushToken_pkey" PRIMARY KEY ("token")
);

CREATE INDEX IF NOT EXISTS "MobilePushToken_userId_idx" ON "MobilePushToken"("userId");

ALTER TABLE "MobilePushToken"
    ADD CONSTRAINT "MobilePushToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Booking.failedRefundAmount (schema'da var, DB'de yok)
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "failedRefundAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Eksik composite index'ler (schema'da var, DB'de yok)
CREATE INDEX IF NOT EXISTS "Booking_shopId_status_idx" ON "Booking"("shopId", "status");
CREATE INDEX IF NOT EXISTS "Booking_status_checkInTime_idx" ON "Booking"("status", "checkInTime");
CREATE INDEX IF NOT EXISTS "Booking_status_checkOutTime_idx" ON "Booking"("status", "checkOutTime");
CREATE INDEX IF NOT EXISTS "Booking_guestId_status_idx" ON "Booking"("guestId", "status");
CREATE INDEX IF NOT EXISTS "Booking_createdAt_idx" ON "Booking"("createdAt");