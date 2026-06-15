DROP INDEX IF EXISTS "Shop_subMerchantKey_key";
DROP INDEX IF EXISTS "Shop_stripeAccountId_key";

ALTER TABLE "Shop"
  DROP COLUMN IF EXISTS "subMerchantKey",
  DROP COLUMN IF EXISTS "subMerchantType",
  DROP COLUMN IF EXISTS "stripeAccountId";

DROP TABLE IF EXISTS "ProcessedPaymentWebhook";
DELETE FROM "FeatureFlag" WHERE "key" = 'payments_enabled';
