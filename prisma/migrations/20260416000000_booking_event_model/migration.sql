-- CreateTable: BookingEvent (append-only audit log for booking lifecycle)
CREATE TABLE "BookingEvent" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" "Role",
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BookingEvent_bookingId_idx" ON "BookingEvent"("bookingId");
CREATE INDEX IF NOT EXISTS "BookingEvent_bookingId_createdAt_idx" ON "BookingEvent"("bookingId", "createdAt");
