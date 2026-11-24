-- Teslimde valiz durumu fotografi (hasar itirazi kaniti). Ekleyici; mevcut tablolara dokunmaz.
-- CreateTable
CREATE TABLE "BagPhoto" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BagPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BagPhoto_key_key" ON "BagPhoto"("key");

-- CreateIndex
CREATE INDEX "BagPhoto_bookingId_deletedAt_idx" ON "BagPhoto"("bookingId", "deletedAt");

-- CreateIndex
CREATE INDEX "BagPhoto_deletedAt_idx" ON "BagPhoto"("deletedAt");

-- AddForeignKey
ALTER TABLE "BagPhoto" ADD CONSTRAINT "BagPhoto_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BagPhoto" ADD CONSTRAINT "BagPhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

