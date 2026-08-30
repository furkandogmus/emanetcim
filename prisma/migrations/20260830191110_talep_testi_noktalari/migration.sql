-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "isPrelaunch" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PrelaunchInterest" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "locale" TEXT,
    "source" TEXT NOT NULL DEFAULT 'web',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrelaunchInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrelaunchInterest_shopId_createdAt_idx" ON "PrelaunchInterest"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "PrelaunchInterest_createdAt_idx" ON "PrelaunchInterest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PrelaunchInterest_shopId_email_key" ON "PrelaunchInterest"("shopId", "email");

-- AddForeignKey
ALTER TABLE "PrelaunchInterest" ADD CONSTRAINT "PrelaunchInterest_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
