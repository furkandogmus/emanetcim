-- Create ShopImage table
CREATE TABLE IF NOT EXISTS "ShopImage" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ShopImage_shopId_idx" ON "ShopImage"("shopId");

ALTER TABLE "ShopImage" ADD CONSTRAINT "ShopImage_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add loyaltyPoints to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loyaltyPoints" INTEGER NOT NULL DEFAULT 0;
