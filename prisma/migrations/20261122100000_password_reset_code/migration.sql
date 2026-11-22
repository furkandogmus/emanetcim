-- Mobil sifre sifirlama kodu: yalnizca hash ve deneme sayaci. Ekleyici; mevcut veriye dokunmaz.
-- CreateTable
CREATE TABLE "PasswordResetCode" (
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "windowFailures" INTEGER NOT NULL DEFAULT 0,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetCode_pkey" PRIMARY KEY ("email")
);

-- CreateIndex
CREATE INDEX "PasswordResetCode_expires_idx" ON "PasswordResetCode"("expires");
