-- Platform business rules (single row, id = default)
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "maxStayDays" INTEGER NOT NULL DEFAULT 30,
    "maxBagsPerSlot" INTEGER NOT NULL DEFAULT 50,
    "insuranceFeeTry" DECIMAL(12,2) NOT NULL DEFAULT 15,
    "earlyRefundRatio" DECIMAL(6,4) NOT NULL DEFAULT 0.9,
    "cancelFixedFeeTry" DECIMAL(12,2) NOT NULL DEFAULT 20,
    "defaultShopCapacity" INTEGER NOT NULL DEFAULT 10,
    "defaultPricePerDay" DECIMAL(12,2) NOT NULL DEFAULT 50,
    "bagMultiplierS" DECIMAL(6,4) NOT NULL DEFAULT 0.8,
    "bagMultiplierM" DECIMAL(6,4) NOT NULL DEFAULT 1.0,
    "bagMultiplierXl" DECIMAL(6,4) NOT NULL DEFAULT 1.5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PlatformSettings" ("id", "updatedAt")
VALUES ('default', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
