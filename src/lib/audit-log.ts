import prisma from "@/lib/db";
import logger from "@/lib/logger";
import type { Prisma } from "@prisma/client";

export type AuditLogInput = {
  actorUserId: string | null;
  actorRole: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
};

/**
 * Admin / finans işlemleri için denetim kaydı (async, hata yutulur).
 */
export function writeAuditLog(input: AuditLogInput): void {
  void prisma.auditLog
    .create({
      data: {
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        metadata: input.metadata ?? undefined,
        ip: input.ip ?? null,
      },
    })
    .catch((err) => {
      logger.error({ err, action: input.action }, "audit_log_write_failed");
    });
}
