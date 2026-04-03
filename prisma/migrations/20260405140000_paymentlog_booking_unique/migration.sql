-- One payment log row per booking (prevents duplicate SUCCESS charges for same booking).
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentLog_bookingId_key" ON "PaymentLog"("bookingId");
