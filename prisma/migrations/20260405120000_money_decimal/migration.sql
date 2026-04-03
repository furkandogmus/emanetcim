-- Money fields: DOUBLE PRECISION -> DECIMAL for TRY tutarları

ALTER TABLE "Shop" ALTER COLUMN "pricePerDay" SET DATA TYPE DECIMAL(12,2) USING "pricePerDay"::numeric;
ALTER TABLE "Shop" ALTER COLUMN "pricePerDay" SET DEFAULT 50;

ALTER TABLE "Booking" ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(12,2) USING "unitPrice"::numeric;
ALTER TABLE "Booking" ALTER COLUMN "totalPrice" SET DATA TYPE DECIMAL(12,2) USING "totalPrice"::numeric;
ALTER TABLE "Booking" ALTER COLUMN "insuranceFee" SET DATA TYPE DECIMAL(12,2) USING "insuranceFee"::numeric;
ALTER TABLE "Booking" ALTER COLUMN "lateFeeApplied" SET DATA TYPE DECIMAL(12,2) USING "lateFeeApplied"::numeric;

ALTER TABLE "PaymentLog" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2) USING "amount"::numeric;

ALTER TABLE "Coupon" ALTER COLUMN "discount" SET DATA TYPE DECIMAL(12,2) USING "discount"::numeric;
ALTER TABLE "Coupon" ALTER COLUMN "minPrice" SET DATA TYPE DECIMAL(12,2) USING COALESCE("minPrice", 0)::numeric;
ALTER TABLE "Coupon" ALTER COLUMN "minPrice" SET DEFAULT 0;

ALTER TABLE "Campaign" ALTER COLUMN "discountPercent" SET DATA TYPE DECIMAL(5,2) USING "discountPercent"::numeric;
