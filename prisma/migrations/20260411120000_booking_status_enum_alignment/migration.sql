-- schema.prisma BookingStatus ile init migration’daki enum’u hizala.
-- Init: PENDING, PAID, CHECKED_IN, CHECKED_OUT, CANCELLED
-- Eksik: WAITING_APPROVAL, APPROVED (PostgreSQL 12+ transaction içinde güvenli)

ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'WAITING_APPROVAL';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
