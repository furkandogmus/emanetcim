-- Gün bazlı çalışma saati ve esnaf izin aralıkları; mevcut dükkanlar eski tek saat çiftinde kalır.
CREATE TABLE "ShopWeeklyHours" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "openingTime" TEXT NOT NULL DEFAULT '09:00',
    "closingTime" TEXT NOT NULL DEFAULT '20:00',

    CONSTRAINT "ShopWeeklyHours_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopClosure" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopClosure_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShopWeeklyHours_shopId_weekday_key" ON "ShopWeeklyHours"("shopId", "weekday");
CREATE INDEX "ShopClosure_shopId_startDate_idx" ON "ShopClosure"("shopId", "startDate");

ALTER TABLE "ShopWeeklyHours" ADD CONSTRAINT "ShopWeeklyHours_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopClosure" ADD CONSTRAINT "ShopClosure_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
