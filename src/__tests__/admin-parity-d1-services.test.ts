import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

/**
 * Web -> mobil yonetici paritesi (D1): web action'larindan servise tasinan
 * govdeler. Kalici silme (kendisi degil, acik rezervasyon, yasakli dalinda zorla
 * iptal, FK, yonetici, odeme gecmisi), IP isareti (bicim, kendi IP'si, denetim
 * kaydi), kullanici suzgecleri, gelen kutusu
 * suzgecleri / toplu silme ve on kayit "iletisime gecildi" denetim kaydi.
 */

const m = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn(), delete: vi.fn() },
    booking: { findFirst: vi.fn() },
    blockedIp: { upsert: vi.fn() },
    contactMessage: { findMany: vi.fn(), groupBy: vi.fn(), count: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
    partnerLead: { updateMany: vi.fn() },
  },
  audit: vi.fn(),
  forceCancel: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ default: m.prisma }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: m.audit }));
vi.mock("@/services/booking/partner-review", () => ({ forceCancelOpenBookingsForUser: m.forceCancel }));
// PartnerLeadService bag olusturucuyu (next-intl yonlendirme zinciri) ithal eder.
vi.mock("@/lib/partner-reset-link", () => ({ createPartnerResetLink: vi.fn() }));
vi.mock("@/services/NotificationService", () => ({ notificationService: {} }));
vi.mock("@/services/ShopService", () => ({ shopService: {} }));

import { adminUserService } from "@/services/AdminUserService";
import { adminInboxService } from "@/services/AdminInboxService";
import { partnerLeadService } from "@/services/PartnerLeadService";

const actor = { userId: "admin-1", ip: "203.0.113.5" };
const auditCalls = () => m.audit.mock.calls.map((c) => c[0]);

beforeEach(() => {
  vi.clearAllMocks();
  m.prisma.user.delete.mockResolvedValue({});
  m.prisma.booking.findFirst.mockResolvedValue(null);
  m.prisma.blockedIp.upsert.mockResolvedValue({});
});

describe("AdminUserService.deleteUser", () => {
  it("kendini silemez; veritabanina gidilmez", async () => {
    expect(await adminUserService.deleteUser("admin-1", actor)).toEqual({ ok: false, error: "cannot_delete_self" });
    expect(m.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("olmayan hesap basari (tekrarlanabilir), silme ve kayit yok", async () => {
    m.prisma.user.findUnique.mockResolvedValue(null);
    expect(await adminUserService.deleteUser("u1", actor)).toEqual({ ok: true });
    expect(m.prisma.user.delete).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });

  it("normal hesapta acik rezervasyon (misafir ya da dukkan sahibi) silmeyi engeller", async () => {
    m.prisma.user.findUnique.mockResolvedValue({ isBanned: false, role: "PARTNER" });
    m.prisma.booking.findFirst.mockResolvedValue({ id: "b1" });
    expect(await adminUserService.deleteUser("u1", actor)).toEqual({ ok: false, error: "has_active_booking" });
    const where = m.prisma.booking.findFirst.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ guestId: "u1" }, { shop: { ownerId: "u1" } }]);
    expect(where.status.in).toContain("CHECKED_IN");
    expect(m.prisma.user.delete).not.toHaveBeenCalled();
  });

  it("yasakli hesapta kapatilamayan rezervasyon (valiz rafta) silmeyi durdurur", async () => {
    m.prisma.user.findUnique.mockResolvedValue({ isBanned: true, role: "GUEST" });
    m.forceCancel.mockResolvedValue({ cancelled: 1, failed: 1 });
    expect(await adminUserService.deleteUser("u1", actor)).toEqual({ ok: false, error: "has_active_booking" });
    expect(m.prisma.booking.findFirst).not.toHaveBeenCalled();
    expect(m.prisma.user.delete).not.toHaveBeenCalled();
  });

  it("FK ihlali `blocked_by_relations` olur, firlatmaz", async () => {
    m.prisma.user.findUnique.mockResolvedValue({ isBanned: false, role: "GUEST" });
    m.prisma.user.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("fk", { code: "P2003", clientVersion: "x" }),
    );
    expect(await adminUserService.deleteUser("u1", actor)).toEqual({ ok: false, error: "blocked_by_relations" });
    expect(m.audit).not.toHaveBeenCalled();
  });

  it("basarida denetim kaydi gerekce ve hedef rolu tasir", async () => {
    m.prisma.user.findUnique.mockResolvedValue({ isBanned: true, role: "GUEST" });
    m.forceCancel.mockResolvedValue({ cancelled: 2, failed: 0 });
    expect(await adminUserService.deleteUser("u1", { ...actor, reason: "  sahte hesap " })).toEqual({ ok: true });
    expect(m.prisma.user.delete).toHaveBeenCalledWith({ where: { id: "u1" } });
    expect(auditCalls()).toEqual([
      expect.objectContaining({
        action: "user.delete",
        entityId: "u1",
        actorUserId: "admin-1",
        metadata: { targetRole: "GUEST", reason: "sahte hesap" },
      }),
    ]);
  });
});

describe("AdminUserService.blockIp / blockUserIp", () => {
  it("bicimsiz IP reddedilir", async () => {
    expect(await adminUserService.blockIp("not-an-ip", null, actor)).toEqual({ ok: false, error: "invalid_ip" });
    expect(m.prisma.blockedIp.upsert).not.toHaveBeenCalled();
  });

  it("yoneticinin kendi IP'si reddedilir", async () => {
    expect(await adminUserService.blockIp("203.0.113.5", null, actor)).toEqual({ ok: false, error: "own_ip" });
    expect(m.prisma.blockedIp.upsert).not.toHaveBeenCalled();
  });

  it("engel yazilir ve denetim kaydi duser (onceden hic dusmuyordu)", async () => {
    expect(await adminUserService.blockIp(" 198.51.100.7 ", " spam ", actor)).toEqual({ ok: true, ip: "198.51.100.7" });
    expect(m.prisma.blockedIp.upsert).toHaveBeenCalledWith({
      where: { ip: "198.51.100.7" },
      update: { reason: "spam" },
      create: { ip: "198.51.100.7", reason: "spam" },
    });
    expect(auditCalls()).toEqual([
      expect.objectContaining({ action: "ip.block", entityType: "BlockedIp", entityId: "198.51.100.7" }),
    ]);
  });

  it("kullanicinin son IP'si kayittan okunur; yoksa no_ip / not_found", async () => {
    m.prisma.user.findUnique.mockResolvedValueOnce(null);
    expect(await adminUserService.blockUserIp("u1", "x", actor)).toEqual({ ok: false, error: "not_found" });
    m.prisma.user.findUnique.mockResolvedValueOnce({ lastIp: null });
    expect(await adminUserService.blockUserIp("u1", "x", actor)).toEqual({ ok: false, error: "no_ip" });
    m.prisma.user.findUnique.mockResolvedValueOnce({ lastIp: "2001:db8::1" });
    expect(await adminUserService.blockUserIp("u1", "spam", actor)).toEqual({ ok: true, ip: "2001:db8::1" });
    expect(auditCalls().at(-1)).toEqual(
      expect.objectContaining({ action: "ip.block", entityType: "User", entityId: "u1", metadata: { ip: "2001:db8::1", reason: "spam" } }),
    );
  });
});

describe("AdminUserService.searchPage suzgecleri", () => {
  beforeEach(() => m.prisma.user.findMany.mockResolvedValue([]));
  const where = () => m.prisma.user.findMany.mock.calls.at(-1)?.[0].where;

  it("suzgecsiz ve sorgusuz istek kosulsuz", async () => {
    await adminUserService.searchPage("");
    expect(where()).toBeUndefined();
  });

  it("web ile ayni anlam: ACTIVE = yasaksiz + dogrulanmis, TEST = isTest", async () => {
    await adminUserService.searchPage("", { filters: { role: "GUEST", status: "ACTIVE", type: "TEST" } });
    expect(where()).toEqual({
      AND: [{ role: "GUEST" }, { isBanned: false, emailVerified: { not: null } }, { isTest: true }],
    });
    await adminUserService.searchPage("", { filters: { status: "UNVERIFIED", type: "REAL" } });
    expect(where()).toEqual({ AND: [{ isBanned: false, emailVerified: null }, { isTest: false }] });
    await adminUserService.searchPage("", { filters: { status: "BANNED" } });
    expect(where()).toEqual({ isBanned: true });
  });

  it("arama ve suzgec birlikte AND olur", async () => {
    await adminUserService.searchPage("ada", { filters: { role: "PARTNER" } });
    const w = where();
    expect(w.AND).toHaveLength(2);
    expect(w.AND[1]).toEqual({ role: "PARTNER" });
  });
});

describe("AdminInboxService", () => {
  it("destek gorunumu siniflandirilmamislari da kapsar; okunmamis ve arama AND", async () => {
    m.prisma.contactMessage.findMany.mockResolvedValue([]);
    await adminInboxService.listPage({ unreadOnly: true, category: "SUPPORT", q: " iade " }, { take: 30 });
    const w = m.prisma.contactMessage.findMany.mock.calls[0][0].where;
    expect(w.AND[0]).toEqual({ isRead: false });
    expect(w.AND[1]).toEqual({ category: { in: ["SUPPORT", "UNCLASSIFIED"] } });
    expect(w.AND[2].OR).toHaveLength(3);
    expect(w.AND[2].OR[0]).toEqual({ from: { contains: "iade", mode: "insensitive" } });
  });

  it("sayilar: UNCLASSIFIED destege eklenir, okunmamis ayrica", async () => {
    m.prisma.contactMessage.groupBy.mockResolvedValue([
      { category: "SUPPORT", _count: { _all: 2 } },
      { category: "UNCLASSIFIED", _count: { _all: 3 } },
      { category: "BULK", _count: { _all: 7 } },
    ]);
    m.prisma.contactMessage.count.mockResolvedValue(4);
    expect(await adminInboxService.counts()).toEqual({ SUPPORT: 5, BULK: 7, AUTOMATED: 0, unread: 4 });
  });

  it("toplu silme tekrarlari ayiklar, 100'de keser ve denetim kaydi yazar", async () => {
    m.prisma.contactMessage.deleteMany.mockResolvedValue({ count: 100 });
    const ids = [...Array.from({ length: 120 }, (_, i) => `m${i}`), "m0"];
    expect(await adminInboxService.removeMany(ids, actor)).toBe(100);
    const sent = m.prisma.contactMessage.deleteMany.mock.calls[0][0].where.id.in;
    expect(sent).toHaveLength(100);
    expect(new Set(sent).size).toBe(100);
    expect(auditCalls()).toEqual([
      expect.objectContaining({ action: "contact_message.bulk_delete", metadata: expect.objectContaining({ deleted: 100 }) }),
    ]);
  });

  it("bos liste veritabanina gitmez", async () => {
    expect(await adminInboxService.removeMany([], actor)).toBe(0);
    expect(m.prisma.contactMessage.deleteMany).not.toHaveBeenCalled();
  });
});

describe("PartnerLeadService.setContacted", () => {
  it("degisirse true ve aktorle denetim kaydi; cevrilmis/olmayan kayitta false, kayit yok", async () => {
    m.prisma.partnerLead.updateMany.mockResolvedValueOnce({ count: 1 });
    expect(await partnerLeadService.setContacted("l1", true, actor)).toBe(true);
    expect(m.prisma.partnerLead.updateMany.mock.calls[0][0].where).toEqual({ id: "l1", convertedAt: null });
    expect(auditCalls()).toEqual([expect.objectContaining({ action: "partner_lead.contacted", entityId: "l1" })]);

    m.prisma.partnerLead.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await partnerLeadService.setContacted("l1", false, actor)).toBe(false);
    expect(m.audit).toHaveBeenCalledTimes(1);
  });
});
