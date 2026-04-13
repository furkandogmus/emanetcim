-- AlterTable: Shop için Stripe Connect hesap alanı (EU ödemeleri)
ALTER TABLE "Shop" ADD COLUMN "stripeAccountId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Shop_stripeAccountId_key" ON "Shop"("stripeAccountId");
