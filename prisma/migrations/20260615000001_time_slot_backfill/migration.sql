-- Migration: Convert existing bookings to time-slot reservation model
-- Run this AFTER the schema migration has been applied.

-- Step 1: Set pricePerHour for shops that don't have it
UPDATE "Shop" SET "pricePerHour" = CASE
  WHEN "pricePerDay" IS NOT NULL AND "pricePerDay" > 0
    THEN ROUND(("pricePerDay" / 24)::numeric, 2)
  ELSE 10
END
WHERE "pricePerHour" IS NULL OR "pricePerHour" = 0;

-- Step 2: Generate initial time slots for active shops (next 30 days)
-- This is done by the application code via generateSlotsForShop()

-- Step 3: Convert existing active bookings to ReservationSlot entries
-- For each booking with status in (PAID, CHECKED_IN, APPROVED),
-- create ReservationSlot entries for each 30-min block between checkInTime and checkOutTime.

DO $$
DECLARE
  booking_rec RECORD;
  slot_rec RECORD;
  slot_start TIMESTAMP;
  slot_end TIMESTAMP;
  total_bags INT;
BEGIN
  FOR booking_rec IN
    SELECT b.* FROM "Booking" b
    WHERE b.status IN ('PAID', 'CHECKED_IN', 'APPROVED')
    AND NOT EXISTS (SELECT 1 FROM "ReservationSlot" rs WHERE rs."bookingId" = b.id)
  LOOP
    total_bags := COALESCE(booking_rec."bagCountS", 0) + COALESCE(booking_rec."bagCountM", 0) + COALESCE(booking_rec."bagCountXl", 0);

    slot_start := booking_rec."checkInTime";
    WHILE slot_start < booking_rec."checkOutTime" LOOP
      slot_end := slot_start + INTERVAL '30 minutes';

      -- Find or create the ShopTimeSlot
      INSERT INTO "ShopTimeSlot" ("shopId", "startTime", "endTime", "capacity", "isActive")
      VALUES (booking_rec."shopId", slot_start, slot_end, 10, true)
      ON CONFLICT ("shopId", "startTime") DO NOTHING;

      -- Create ReservationSlot
      SELECT id INTO slot_rec FROM "ShopTimeSlot" WHERE "shopId" = booking_rec."shopId" AND "startTime" = slot_start;
      IF slot_rec.id IS NOT NULL THEN
        INSERT INTO "ReservationSlot" ("bookingId", "slotId", "bagCount")
        VALUES (booking_rec.id, slot_rec.id, total_bags)
        ON CONFLICT ("bookingId", "slotId") DO NOTHING;
      END IF;

      slot_start := slot_end;
    END LOOP;
  END LOOP;
END $$;
