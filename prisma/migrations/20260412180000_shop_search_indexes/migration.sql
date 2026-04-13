-- Aktif + koordinatlı dükkanlar için kısmi indeks (mesafe alt sorgusu)
CREATE INDEX IF NOT EXISTS "Shop_active_coords_partial_idx" ON "Shop" ("latitude", "longitude")
WHERE "isActive" = true AND "latitude" IS NOT NULL AND "longitude" IS NOT NULL;

-- ST_Distance (geography) için GiST — PostGIS
CREATE INDEX IF NOT EXISTS "Shop_active_location_gist_idx" ON "Shop"
USING GIST (
  (geography(ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)))
)
WHERE "isActive" = true AND "latitude" IS NOT NULL AND "longitude" IS NOT NULL;
