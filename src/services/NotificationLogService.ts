import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { cursorArgs, toPage } from "@/lib/cursor-page";

/** `ALL` ya da bos = suzgec yok. `q` alici adresinde/numarasinda arar. */
export type NotificationLogFilter = {
  status?: string | null;
  type?: string | null;
  q?: string | null;
};

const MAX_Q = 100;

function whereFor(f: NotificationLogFilter): Prisma.NotificationLogWhereInput | undefined {
  const and: Prisma.NotificationLogWhereInput[] = [];
  if (f.status && f.status !== "ALL") and.push({ status: f.status });
  if (f.type && f.type !== "ALL") and.push({ type: f.type });
  const q = f.q?.trim().slice(0, MAX_Q);
  if (q) and.push({ recipient: { contains: q, mode: "insensitive" } });
  return and.length ? { AND: and } : undefined;
}

/**
 * Bildirim defteri okumasi (salt okuma). Web `/admin/notifications` ve mobil
 * `admin/notification-logs` ayni suzgeci kullanir: biri "gitmedi" derken digeri
 * "gitti" demesin.
 */
export class NotificationLogService {
  async listPage(filter: NotificationLogFilter, opts: { cursor?: string | null; take?: number } = {}) {
    const take = opts.take ?? 30;
    const rows = await prisma.notificationLog.findMany({
      where: whereFor(filter),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...cursorArgs(opts.cursor ?? null, take),
    });
    return toPage(rows, take);
  }

  /** Suzgec secenekleri ve basarisiz sayisi (suzgecten bagimsiz). */
  async facets() {
    const [typeGroups, statusGroups, failedCount] = await Promise.all([
      prisma.notificationLog.groupBy({ by: ["type"], _count: true, orderBy: { type: "asc" } }),
      prisma.notificationLog.groupBy({ by: ["status"], _count: true, orderBy: { status: "asc" } }),
      prisma.notificationLog.count({ where: { status: { not: "SENT" } } }),
    ]);
    return {
      types: typeGroups.map((g) => g.type),
      statuses: statusGroups.map((g) => g.status),
      failedCount,
    };
  }
}

export const notificationLogService = new NotificationLogService();
