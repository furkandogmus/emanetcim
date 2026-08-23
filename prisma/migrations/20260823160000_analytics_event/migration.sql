-- Birinci taraf kullanıcı analitiği: tek, genel amaçlı olay tablosu.
--
-- Ayrı bir analitik altyapısı (ClickHouse, ayrı ingest servisi) yerine mevcut
-- Postgres'e tek tablo — free-tier'da ek altyapı maliyeti yok, mevcut connection
-- pool'u kullanılıyor. Kişisel veri asgaride: userId opsiyonel, IP/User-Agent
-- hiç tutulmuyor. `cleanup` iç işi 90 günden eski kayıtları silecek (bkz.
-- src/lib/jobs/registry.ts) — tablo sınırsız büyümesin diye.

CREATE TABLE "AnalyticsEvent" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId"    TEXT,
    "path"      TEXT,
    "referrer"  TEXT,
    "locale"    TEXT,
    "metadata"  JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnalyticsEvent_name_createdAt_idx" ON "AnalyticsEvent"("name", "createdAt");
CREATE INDEX "AnalyticsEvent_sessionId_idx" ON "AnalyticsEvent"("sessionId");
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");
