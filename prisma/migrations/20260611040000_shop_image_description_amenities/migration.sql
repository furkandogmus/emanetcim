-- Shop modeline image, description ve amenity alanları eklendi
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "image" TEXT;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "hasCctv" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "hasClimateControl" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "acceptsLargeItems" BOOLEAN NOT NULL DEFAULT false;
