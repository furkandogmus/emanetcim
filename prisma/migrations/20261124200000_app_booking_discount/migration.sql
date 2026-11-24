-- Uygulama kanali indirimi: platform ayari (varsayilan %10, sahip karari) ve rezervasyondaki tutar.
ALTER TABLE "PlatformSettings" ADD COLUMN "appBookingDiscountPct" DECIMAL(5,2) NOT NULL DEFAULT 10;
ALTER TABLE "Booking" ADD COLUMN "appDiscountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
