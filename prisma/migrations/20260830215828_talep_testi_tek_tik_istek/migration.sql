-- CreateTable
CREATE TABLE "PrelaunchWant" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "anonId" TEXT NOT NULL,
    "locale" TEXT,
    "source" TEXT NOT NULL DEFAULT 'web',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrelaunchWant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrelaunchWant_shopId_createdAt_idx" ON "PrelaunchWant"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "PrelaunchWant_createdAt_idx" ON "PrelaunchWant"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PrelaunchWant_shopId_anonId_key" ON "PrelaunchWant"("shopId", "anonId");

-- AddForeignKey
ALTER TABLE "PrelaunchWant" ADD CONSTRAINT "PrelaunchWant_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
