-- Zamanlanmış iş çalıştırma defteri.
--
-- P1-11 (2026-08-22 denetimi): iş tanımları üç ayrı yere dağılmıştı ve hiçbiri
-- diğerini bilmiyordu. Bir işin ÇALIŞTIĞINI hiçbir yer kaydetmiyordu, dolayısıyla
-- ÇALIŞMADIĞINI da kimse söyleyemiyordu. İki kez ısırdı: slot üretimi 37 gün durdu
-- (P0-1), ödeme mutabakat cron'u 2 ay boyunca 404 aldı (P1-1b).

CREATE TABLE "JobRun" (
    "id"         TEXT NOT NULL,
    "job"        TEXT NOT NULL,
    "startedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status"     TEXT NOT NULL DEFAULT 'RUNNING',
    "durationMs" INTEGER,
    "detail"     JSONB,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JobRun_job_startedAt_idx" ON "JobRun"("job", "startedAt");
CREATE INDEX "JobRun_job_status_finishedAt_idx" ON "JobRun"("job", "status", "finishedAt");
