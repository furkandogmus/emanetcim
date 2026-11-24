-- Apple Wallet kart kayitlari (PassKit web servisi). Ekleyici; mevcut veriye dokunmaz.
-- CreateTable
CREATE TABLE "WalletPassDevice" (
    "id" TEXT NOT NULL,
    "deviceLibraryId" TEXT NOT NULL,
    "pushToken" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletPassDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WalletPassDevice_bookingId_idx" ON "WalletPassDevice"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletPassDevice_deviceLibraryId_bookingId_key" ON "WalletPassDevice"("deviceLibraryId", "bookingId");

-- AddForeignKey
ALTER TABLE "WalletPassDevice" ADD CONSTRAINT "WalletPassDevice_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
