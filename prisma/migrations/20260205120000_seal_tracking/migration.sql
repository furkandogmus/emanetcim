-- CreateEnum
CREATE TYPE "SealStatus" AS ENUM ('STOCK', 'ASSIGNED', 'IN_USE', 'RETURNED', 'FAULTY');

-- CreateTable
CREATE TABLE "Seal" (
    "serialNumber" INTEGER NOT NULL,
    "shopId" TEXT,
    "status" "SealStatus" NOT NULL DEFAULT 'STOCK',
    "assignedAt" TIMESTAMP(3),

    CONSTRAINT "Seal_pkey" PRIMARY KEY ("serialNumber")
);

-- CreateTable
CREATE TABLE "BookingSeal" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "sealNumber" INTEGER NOT NULL,
    "bagIndex" INTEGER NOT NULL,
    "bagSize" TEXT NOT NULL,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingSeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Seal_shopId_idx" ON "Seal"("shopId");

-- CreateIndex
CREATE INDEX "Seal_status_idx" ON "Seal"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSeal_bookingId_bagIndex_key" ON "BookingSeal"("bookingId", "bagIndex");

-- CreateIndex
CREATE INDEX "BookingSeal_sealNumber_idx" ON "BookingSeal"("sealNumber");

-- AddForeignKey
ALTER TABLE "Seal" ADD CONSTRAINT "Seal_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSeal" ADD CONSTRAINT "BookingSeal_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSeal" ADD CONSTRAINT "BookingSeal_sealNumber_fkey" FOREIGN KEY ("sealNumber") REFERENCES "Seal"("serialNumber") ON DELETE RESTRICT ON UPDATE CASCADE;
