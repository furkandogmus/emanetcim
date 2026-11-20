-- Mobil uygulamayi acan cihazlar: tekil kullanici sayaci (MobileInstall).
-- CreateTable
CREATE TABLE "MobileInstall" (
    "installId" TEXT NOT NULL,
    "userId" TEXT,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileInstall_pkey" PRIMARY KEY ("installId")
);

-- CreateIndex
CREATE INDEX "MobileInstall_lastSeenAt_idx" ON "MobileInstall"("lastSeenAt");

-- CreateIndex
CREATE INDEX "MobileInstall_userId_idx" ON "MobileInstall"("userId");

-- AddForeignKey
ALTER TABLE "MobileInstall" ADD CONSTRAINT "MobileInstall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

