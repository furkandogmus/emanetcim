-- Mobil kodla giris: kimlik basina tek kod, yalnizca hash ve deneme sayaclari. Ekleyici; mevcut veriye dokunmaz.
-- Eski duz kod satirlari (VerificationToken, identifier 'mobile:...') artik okunmaz; bes dakikalik omurleri doldugunda temizlik siler.
-- CreateTable
CREATE TABLE "MobileLoginCode" (
    "identity" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "windowFailures" INTEGER NOT NULL DEFAULT 0,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileLoginCode_pkey" PRIMARY KEY ("identity")
);

-- CreateIndex
CREATE INDEX "MobileLoginCode_expires_idx" ON "MobileLoginCode"("expires");
