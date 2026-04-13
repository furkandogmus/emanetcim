-- AddColumn referralCode to User
ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- AddColumn referredByCode and referralDiscountAmount to Booking
ALTER TABLE "Booking" ADD COLUMN "referredByCode" TEXT;
ALTER TABLE "Booking" ADD COLUMN "referralDiscountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
