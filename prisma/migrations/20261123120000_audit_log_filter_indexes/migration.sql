-- Denetim kaydi filtreleri (eylem oneki, aktor) tabloyu taramasin. Yalnizca ekleme.
-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");
