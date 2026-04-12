-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "rolloutPct" INTEGER NOT NULL DEFAULT 100,
    "allowedUserIds" JSONB,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "FeatureFlag_key_idx" ON "FeatureFlag"("key");

-- Default row: payments on (matches previous env-only default)
INSERT INTO "FeatureFlag" ("id", "key", "enabled", "rolloutPct", "allowedUserIds", "description", "createdAt", "updatedAt")
VALUES (
  'ff_payments_enabled',
  'payments_enabled',
  true,
  100,
  NULL,
  'iyzico/Stripe init, webhooks, refunds',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
