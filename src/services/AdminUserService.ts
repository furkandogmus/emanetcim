import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";

export type AdminActor = { userId: string | null; ip: string | null };

const LIST_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isBanned: true,
  isTest: true,
  createdAt: true,
  _count: { select: { bookings: true, shops: true } },
} as const satisfies Prisma.UserSelect;

export class AdminUserService {
  /** Ad, e-posta ya da telefonla arama; bos sorgu en yeni kullanicilari verir. */
  async search(q: string, take = 50) {
    const term = q.trim();
    return prisma.user.findMany({
      where: term
        ? {
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { email: { contains: term, mode: "insensitive" } },
              { phone: { contains: term.replace(/\s+/g, "") } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take,
      select: LIST_SELECT,
    });
  }

  /*
    Yasaklama `tokenVersion`i da artirir: acik web oturumu ve mobil token'lar
    aninda duser. Kendini yasaklamak reddedilir: tek admin kendini kilitlerdi.
  */
  async setBanned(
    userId: string,
    isBanned: boolean,
    actor: AdminActor,
  ): Promise<{ ok: true } | { ok: false; error: "not_found" | "cannot_ban_self" }> {
    if (actor.userId != null && actor.userId === userId && isBanned) {
      return { ok: false, error: "cannot_ban_self" };
    }
    const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) return { ok: false, error: "not_found" };

    await prisma.user.update({
      where: { id: userId },
      data: { isBanned, tokenVersion: { increment: 1 } },
    });
    writeAuditLog({
      actorUserId: actor.userId,
      actorRole: "ADMIN",
      action: "user.ban_toggle",
      entityType: "User",
      entityId: userId,
      metadata: { isBanned },
      ip: actor.ip,
    });
    return { ok: true };
  }
}

export const adminUserService = new AdminUserService();
