-- CreateEnum
CREATE TYPE "MerchantLegalType" AS ENUM ('INDIVIDUAL', 'SOLE_PROPRIETORSHIP', 'COMPANY');

-- CreateEnum
CREATE TYPE "MerchantAccountStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SplitStatus" AS ENUM ('PENDING', 'SETTLED', 'REVERSED');

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "platformCommissionRate" DECIMAL(6,4) NOT NULL DEFAULT 0.5;

-- CreateTable
CREATE TABLE "MerchantProfile" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "legalType" "MerchantLegalType" NOT NULL,
    "legalName" TEXT NOT NULL,
    "tckn" TEXT,
    "vkn" TEXT,
    "taxOffice" TEXT,
    "iban" TEXT NOT NULL,
    "ibanHolder" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantPaymentAccount" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT,
    "status" "MerchantAccountStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantPaymentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSplit" (
    "id" TEXT NOT NULL,
    "paymentLogId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "commissionRate" DECIMAL(6,4) NOT NULL,
    "platformCommission" DECIMAL(12,2) NOT NULL,
    "merchantAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "status" "SplitStatus" NOT NULL DEFAULT 'PENDING',
    "providerRef" TEXT,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSplit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MerchantProfile_shopId_key" ON "MerchantProfile"("shopId");

-- CreateIndex
CREATE INDEX "MerchantProfile_legalType_idx" ON "MerchantProfile"("legalType");

-- CreateIndex
CREATE INDEX "MerchantProfile_verifiedAt_idx" ON "MerchantProfile"("verifiedAt");

-- CreateIndex
CREATE INDEX "MerchantPaymentAccount_provider_status_idx" ON "MerchantPaymentAccount"("provider", "status");

-- CreateIndex
CREATE INDEX "MerchantPaymentAccount_status_idx" ON "MerchantPaymentAccount"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantPaymentAccount_shopId_provider_key" ON "MerchantPaymentAccount"("shopId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSplit_paymentLogId_key" ON "PaymentSplit"("paymentLogId");

-- CreateIndex
CREATE INDEX "PaymentSplit_shopId_status_idx" ON "PaymentSplit"("shopId", "status");

-- CreateIndex
CREATE INDEX "PaymentSplit_status_idx" ON "PaymentSplit"("status");

-- CreateIndex
CREATE INDEX "PaymentSplit_createdAt_idx" ON "PaymentSplit"("createdAt");

-- AddForeignKey
ALTER TABLE "MerchantProfile" ADD CONSTRAINT "MerchantProfile_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantPaymentAccount" ADD CONSTRAINT "MerchantPaymentAccount_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSplit" ADD CONSTRAINT "PaymentSplit_paymentLogId_fkey" FOREIGN KEY ("paymentLogId") REFERENCES "PaymentLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSplit" ADD CONSTRAINT "PaymentSplit_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

