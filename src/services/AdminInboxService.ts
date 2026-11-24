import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { cursorArgs, toPage } from "@/lib/cursor-page";
import type { AdminActor } from "@/services/AdminUserService";

/** Web kutusundaki gorunumler; `SUPPORT` siniflandirilmamislari da kapsar (web ile ayni). */
export const INBOX_CATEGORIES = ["SUPPORT", "BULK", "AUTOMATED"] as const;
export type InboxCategory = (typeof INBOX_CATEGORIES)[number];

export type InboxFilters = {
  unreadOnly?: boolean;
  category?: InboxCategory | null;
  q?: string;
};

/** Tek istekte silinebilecek en fazla mesaj (web toplu silme ile ayni sinir). */
export const INBOX_BULK_MAX = 100;

const MOBILE_SELECT = {
  id: true,
  from: true,
  subject: true,
  text: true,
  html: true,
  isRead: true,
  category: true,
  createdAt: true,
  replies: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
} satisfies Prisma.ContactMessageSelect;

function categoryWhere(category: InboxCategory): Prisma.ContactMessageWhereInput {
  return category === "SUPPORT" ? { category: { in: ["SUPPORT", "UNCLASSIFIED"] } } : { category };
}

function inboxWhere(f: InboxFilters): Prisma.ContactMessageWhereInput | undefined {
  const and: Prisma.ContactMessageWhereInput[] = [];
  if (f.unreadOnly) and.push({ isRead: false });
  if (f.category) and.push(categoryWhere(f.category));
  const term = f.q?.trim().slice(0, 100);
  if (term) {
    and.push({
      OR: [
        { from: { contains: term, mode: "insensitive" } },
        { subject: { contains: term, mode: "insensitive" } },
        { text: { contains: term, mode: "insensitive" } },
      ],
    });
  }
  return and.length ? { AND: and } : undefined;
}

/**
 * Admin gelen kutusu (iletisim mesajlari): mobil liste, okundu, tekli ve toplu
 * silme. Web kutusu ayni kategori anlamini kullanir (`AdminMessagesClient`).
 */
export class AdminInboxService {
  async listPage(f: InboxFilters, opts: { cursor?: string | null; take: number }) {
    const rows = await prisma.contactMessage.findMany({
      where: inboxWhere(f),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: MOBILE_SELECT,
      ...cursorArgs(opts.cursor ?? null, opts.take),
    });
    return toPage(rows, opts.take);
  }

  /** Eski istemci (0.3.0-0.3.3) icin suzgecsiz ilk N. */
  async listRecent(take: number) {
    return prisma.contactMessage.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: MOBILE_SELECT,
      take,
    });
  }

  /** Kategori sekmelerindeki sayilar ve okunmamis toplami. */
  async counts(): Promise<Record<InboxCategory, number> & { unread: number }> {
    const [groups, unread] = await Promise.all([
      prisma.contactMessage.groupBy({ by: ["category"], _count: { _all: true } }),
      prisma.contactMessage.count({ where: { isRead: false } }),
    ]);
    const out = { SUPPORT: 0, BULK: 0, AUTOMATED: 0, unread };
    for (const g of groups) {
      const key = g.category === "UNCLASSIFIED" ? "SUPPORT" : g.category;
      if (key === "SUPPORT" || key === "BULK" || key === "AUTOMATED") out[key] += g._count._all;
    }
    return out;
  }

  async markRead(id: string): Promise<boolean> {
    // `update` olmayan kayitta P2025 firlatip 500 veriyordu; sayi kontrolu 404.
    const { count } = await prisma.contactMessage.updateMany({ where: { id }, data: { isRead: true } });
    return count > 0;
  }

  async remove(id: string): Promise<boolean> {
    const { count } = await prisma.contactMessage.deleteMany({ where: { id } });
    return count > 0;
  }

  /** Toplu sil; denetim kaydi sayiyi ve kimlikleri tutar (icerik degil). */
  async removeMany(ids: string[], actor: AdminActor): Promise<number> {
    const unique = [...new Set(ids)].slice(0, INBOX_BULK_MAX);
    if (unique.length === 0) return 0;
    const { count } = await prisma.contactMessage.deleteMany({ where: { id: { in: unique } } });
    writeAuditLog({
      actorUserId: actor.userId,
      actorRole: "ADMIN",
      action: "contact_message.bulk_delete",
      entityType: "ContactMessage",
      metadata: { requested: unique.length, deleted: count, ids: unique },
      ip: actor.ip,
    });
    return count;
  }
}

export const adminInboxService = new AdminInboxService();
