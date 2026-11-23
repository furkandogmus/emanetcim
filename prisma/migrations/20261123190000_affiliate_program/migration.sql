-- Araci (affiliate) programi: araci kaydi, gunluk tiklama sayaci, komisyon defteri ve
-- rezervasyonda atif + oran kopyasi. Yalnizca ekleme: mevcut rezervasyonlar atifsiz kalir.
-- CreateEnum
CREATE TYPE "AffiliateType" AS ENUM ('AIRBNB_HOST', 'HOTEL', 'GUIDE', 'AGENCY', 'OTHER');

-- CreateEnum
CREATE TYPE "AffiliateStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "AffiliateCommissionStatus" AS ENUM ('UNPAID', 'PAID');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "affiliateCommissionRate" DECIMAL(5,2),
ADD COLUMN     "affiliateDiscountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "affiliateGuestDiscountRate" DECIMAL(5,2),
ADD COLUMN     "affiliateId" TEXT;

-- CreateTable
CREATE TABLE "Affiliate" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "type" "AffiliateType" NOT NULL DEFAULT 'OTHER',
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "code" TEXT NOT NULL,
    "commissionRate" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "guestDiscountRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "status" "AffiliateStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "applicationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Affiliate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateClickDay" (
    "affiliateId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AffiliateClickDay_pkey" PRIMARY KEY ("affiliateId","day")
);

-- CreateTable
CREATE TABLE "AffiliateCommission" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "baseAmount" DECIMAL(12,2) NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL,
    "status" "AffiliateCommissionStatus" NOT NULL DEFAULT 'UNPAID',
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "payoutReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateCommission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_userId_key" ON "Affiliate"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_code_key" ON "Affiliate"("code");

-- CreateIndex
CREATE INDEX "Affiliate_status_idx" ON "Affiliate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateCommission_bookingId_key" ON "AffiliateCommission"("bookingId");

-- CreateIndex
CREATE INDEX "AffiliateCommission_affiliateId_status_idx" ON "AffiliateCommission"("affiliateId", "status");

-- CreateIndex
CREATE INDEX "AffiliateCommission_status_earnedAt_idx" ON "AffiliateCommission"("status", "earnedAt");

-- CreateIndex
CREATE INDEX "Booking_affiliateId_idx" ON "Booking"("affiliateId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateClickDay" ADD CONSTRAINT "AffiliateClickDay_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

