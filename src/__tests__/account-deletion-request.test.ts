import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

/** Esnaf/yonetici hesap silme talebi (App Store 5.1.1(v)): talep, tamamlama, iptal. */

const m = vi.hoisted(() => {
  const ok = () => vi.fn().mockResolvedValue({});
  const db = {
    user: { findUnique: vi.fn(), count: vi.fn(), update: ok() },
    booking: { count: vi.fn(), updateMany: ok() },
    paymentSplit: { count: vi.fn() },
    shop: { findMany: vi.fn(), updateMany: ok() },
    accountDeletionRequest: { findUnique: vi.fn(), findMany: vi.fn(), create: ok(), update: ok(), updateMany: vi.fn() },
    session: { deleteMany: ok() },
    account: { deleteMany: ok() },
    review: { deleteMany: ok(), updateMany: ok() },
    reviewReport: { deleteMany: ok(), findMany: vi.fn() },
    reviewBlock: { deleteMany: ok() },
    legalAcceptance: { deleteMany: ok() },
    pushSubscription: { deleteMany: ok() },
    mobilePushToken: { deleteMany: ok() },
    mobileInstall: { deleteMany: ok() },
    shopMember: { deleteMany: ok() },
    bagPhoto: { updateMany: ok() },
    shopInvite: { deleteMany: ok() },
    merchantProfile: { deleteMany: ok() },
    passwordResetCode: { deleteMany: ok() },
    mobileLoginCode: { deleteMany: ok() },
    verificationToken: { deleteMany: ok() },
    $transaction: vi.fn(),
  };
  return {
    db,
    capturesOnline: { value: false },
    audit: vi.fn(),
    notifyAdmins: vi.fn().mockResolvedValue(undefined),
    completedEmail: vi.fn().mockResolvedValue(undefined),
    collect: vi.fn().mockResolvedValue([]),
    revoke: vi.fn().mockResolvedValue(0),
  };
});

vi.mock("@/lib/db", () => ({ default: m.db }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: m.audit }));
vi.mock("@/lib/payments", () => ({
  getPaymentProvider: () => ({ capabilities: { capturesOnline: m.capturesOnline.value } }),
}));
vi.mock("@/services/booking/closure", () => ({ closeExpiredBookingsForGuest: vi.fn().mockResolvedValue(0) }));
vi.mock("@/services/AppleTokenService", () => ({
  appleTokenService: { collectForUser: m.collect, revokeTokens: m.revoke },
}));
vi.mock("@/services/NotificationService", () => ({
  notificationService: {
    notifyAdminsForDeletionRequest: m.notifyAdmins,
    sendAccountDeletionCompleted: m.completedEmail,
  },
}));

import { ACCOUNT_DELETION_SLA_DAYS, accountPrivacyService } from "@/services/AccountPrivacyService";

const PARTNER = { id: "p1", name: "Ayse", email: "ayse@example.com" };
const STAMP = new Date("2026-11-24T09:00:00.000Z");
/** Rollback'i taklit eder: islem fonksiyonu firlatirsa yapilan yazmalar sayilmaz ama cagrilar kalir. */
function runTx() {
  m.db.$transaction.mockImplementation(async (fn: unknown) =>
    typeof fn === "function" ? (fn as (t: typeof m.db) => unknown)(m.db) : [],
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // `...Once` kuyruklari clearAllMocks ile bosalmiyor; testler arasi sizmasin.
  for (const fn of [m.db.shop.findMany, m.db.accountDeletionRequest.findUnique, m.db.booking.count, m.db.accountDeletionRequest.create]) {
    fn.mockReset();
  }
  m.db.accountDeletionRequest.create.mockResolvedValue({});
  runTx();
  m.capturesOnline.value = false;
  m.db.booking.count.mockResolvedValue(0);
  m.db.paymentSplit.count.mockResolvedValue(0);
  m.db.user.count.mockResolvedValue(1);
  m.db.reviewReport.findMany.mockResolvedValue([]);
  m.db.accountDeletionRequest.updateMany.mockResolvedValue({ count: 1 });
});

describe("requestDeletion", () => {
  beforeEach(() => {
    m.db.user.findUnique.mockResolvedValue(PARTNER);
    m.db.accountDeletionRequest.findUnique.mockResolvedValue(null);
    m.db.accountDeletionRequest.updateMany.mockResolvedValue({ count: 0 });
    m.db.shop.findMany
      .mockResolvedValueOnce([{ id: "s1" }, { id: "s2" }])
      .mockResolvedValueOnce([
        { id: "s1", updatedAt: STAMP },
        { id: "s2", updatedAt: STAMP },
      ]);
  });

  it("esnaf: talep acilir, dukkanlar kapanir ve damgalari saklanir, yoneticiye bir kez haber gider", async () => {
    const r = await accountPrivacyService.requestDeletion({ userId: "p1", role: "PARTNER", ip: null, locale: "en" });

    expect(r).toMatchObject({ ok: true, alreadyPending: false, slaDays: ACCOUNT_DELETION_SLA_DAYS });
    if (!r.ok) throw new Error("unreachable");
    expect(Math.round((r.dueAt.getTime() - Date.now()) / 86_400_000)).toBe(30);
    expect(m.db.accountDeletionRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "p1", status: "PENDING", contactEmail: "ayse@example.com", contactLocale: "en" }),
    });
    expect(m.db.shop.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["s1", "s2"] } }, data: { isActive: false } });
    expect(m.db.accountDeletionRequest.update).toHaveBeenCalledWith({
      where: { userId: "p1" },
      data: {
        deactivatedShops: [
          { id: "s1", updatedAt: STAMP.toISOString() },
          { id: "s2", updatedAt: STAMP.toISOString() },
        ],
      },
    });
    expect(m.notifyAdmins).toHaveBeenCalledTimes(1);
  });

  it("bekleyen talep varsa hicbir sey yazilmaz ve bildirim gitmez", async () => {
    const dueAt = new Date("2026-12-23T00:00:00Z");
    m.db.accountDeletionRequest.findUnique.mockResolvedValue({ status: "PENDING", dueAt });
    const r = await accountPrivacyService.requestDeletion({ userId: "p1", role: "PARTNER", ip: null });
    expect(r).toEqual({ ok: true, alreadyPending: true, dueAt, slaDays: 30 });
    expect(m.db.$transaction).not.toHaveBeenCalled();
    expect(m.notifyAdmins).not.toHaveBeenCalled();
  });

  it("esanli ikinci istek benzersiz anahtarda duser: dukkan listesi ezilmez, ikinci bildirim yok", async () => {
    const dueAt = new Date("2026-12-23T00:00:00Z");
    m.db.accountDeletionRequest.findUnique
      .mockResolvedValueOnce(null) // on kontrol: henuz yok
      .mockResolvedValueOnce(null) // islem ici: yok, create denenir
      .mockResolvedValueOnce({ status: "PENDING", dueAt }); // P2002 sonrasi okuma
    m.db.accountDeletionRequest.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "7" }),
    );
    const r = await accountPrivacyService.requestDeletion({ userId: "p1", role: "PARTNER", ip: null });
    expect(r).toEqual({ ok: true, alreadyPending: true, dueAt, slaDays: 30 });
    expect(m.db.shop.updateMany).not.toHaveBeenCalled();
    expect(m.db.accountDeletionRequest.update).not.toHaveBeenCalled();
    expect(m.notifyAdmins).not.toHaveBeenCalled();
  });

  it("misafir talep acmaz; son yonetici talep acamaz", async () => {
    await expect(accountPrivacyService.requestDeletion({ userId: "g1", role: "GUEST", ip: null })).resolves.toEqual({
      ok: false,
      reason: "guest_use_delete",
    });
    m.db.user.count.mockResolvedValue(0);
    await expect(accountPrivacyService.requestDeletion({ userId: "a1", role: "ADMIN", ip: null })).resolves.toEqual({
      ok: false,
      reason: "last_admin",
    });
    expect(m.db.$transaction).not.toHaveBeenCalled();
  });
});

describe("completeDeletionRequest", () => {
  const REQ = {
    id: "r1",
    userId: "p1",
    role: "PARTNER",
    status: "PENDING",
    contactEmail: "ayse@example.com",
    contactLocale: "en",
    deactivatedShops: [],
  };
  const complete = () =>
    accountPrivacyService.completeDeletionRequest({ requestId: "r1", actor: { userId: "a1", ip: "198.51.100.7" } });

  beforeEach(() => {
    m.db.accountDeletionRequest.findUnique.mockResolvedValue(REQ);
    m.db.user.findUnique.mockResolvedValue({ email: "ayse@example.com", role: "PARTNER" });
    m.collect.mockResolvedValue([{ c: "com.bagajpark", r: "rt" }]);
  });

  it("talep sahiplenilir, tum dukkanlar kapanir, ayni silme govdesi calisir; Apple iptali ve e-posta islemden sonra", async () => {
    await expect(complete()).resolves.toEqual({ ok: true });
    expect(m.db.accountDeletionRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "r1", status: "PENDING" },
      data: expect.objectContaining({ status: "COMPLETED", resolvedById: "a1", contactEmail: null }),
    });
    expect(m.db.shop.updateMany).toHaveBeenCalledWith({ where: { ownerId: "p1", isActive: true }, data: { isActive: false } });
    expect(m.db.merchantProfile.deleteMany).toHaveBeenCalledWith({ where: { shop: { ownerId: "p1" } } });
    // Hesaba bagli rezervasyonlarda tezgahta yazilmis iletisim de silinir.
    expect(m.db.booking.updateMany).toHaveBeenCalledWith({
      where: { guestId: "p1" },
      data: { guestName: null, guestEmail: null, guestPhone: null },
    });
    expect(m.db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p1" }, data: expect.objectContaining({ tokenVersion: { increment: 1 } }) }),
    );
    const txAt = m.db.$transaction.mock.invocationCallOrder[0];
    expect(m.collect.mock.invocationCallOrder[0]).toBeLessThan(txAt);
    expect(m.revoke).toHaveBeenCalledWith("p1", [{ c: "com.bagajpark", r: "rt" }]);
    expect(m.completedEmail).toHaveBeenCalledWith("ayse@example.com", "en");
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "account.deletion_completed", ip: "198.51.100.7" }));
  });

  it("elle tahsilatta bekleyen PaymentSplit engel degil (para zaten esnafta)", async () => {
    m.db.paymentSplit.count.mockResolvedValue(4);
    await expect(complete()).resolves.toEqual({ ok: true });
    expect(m.db.paymentSplit.count).not.toHaveBeenCalled();
  });

  it("online tahsilatta bekleyen hakedis tamamlamayi durdurur; denetim kaydi ve e-posta yok", async () => {
    m.capturesOnline.value = true;
    m.db.paymentSplit.count.mockResolvedValue(1);
    await expect(complete()).resolves.toEqual({ ok: false, reason: "pending_payouts" });
    expect(m.db.user.update).not.toHaveBeenCalled();
    expect(m.revoke).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.completedEmail).not.toHaveBeenCalled();
  });

  it("aktif rezervasyon kilit altinda yeniden sayilir", async () => {
    m.db.booking.count.mockResolvedValueOnce(0).mockResolvedValueOnce(2);
    await expect(complete()).resolves.toEqual({ ok: false, reason: "active_bookings" });
    expect(m.db.user.update).not.toHaveBeenCalled();
  });

  it("esanli iptal ya da ikinci tamamlama sahiplenmeyi kaybeder: hicbir yan etki yok", async () => {
    m.db.accountDeletionRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(complete()).resolves.toEqual({ ok: false, reason: "not_pending" });
    expect(m.db.user.update).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.completedEmail).not.toHaveBeenCalled();
  });

  it("yonetici talebi: hic aktif yonetici kalmayacaksa reddedilir; tamamlaninca misafire indirilir", async () => {
    m.db.accountDeletionRequest.findUnique.mockResolvedValue({ ...REQ, userId: "a2", role: "ADMIN" });
    m.db.user.count.mockResolvedValue(0);
    await expect(complete()).resolves.toEqual({ ok: false, reason: "last_admin" });

    m.db.user.count.mockResolvedValue(1);
    m.db.user.findUnique.mockResolvedValue({ email: "a2@example.com", role: "ADMIN" });
    await expect(complete()).resolves.toEqual({ ok: true });
    expect(m.db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "a2" }, data: expect.objectContaining({ role: "GUEST" }) }),
    );
  });

  it("yonetici kendi talebini tamamlayamaz; bitmis talep tekrar islenmez", async () => {
    m.db.accountDeletionRequest.findUnique.mockResolvedValue({ ...REQ, userId: "a1" });
    await expect(complete()).resolves.toEqual({ ok: false, reason: "cannot_delete_self" });
    m.db.accountDeletionRequest.findUnique.mockResolvedValue({ ...REQ, status: "COMPLETED" });
    await expect(complete()).resolves.toEqual({ ok: false, reason: "not_pending" });
  });
});

describe("cancelDeletionRequest", () => {
  const cancel = () =>
    accountPrivacyService.cancelDeletionRequest({ requestId: "r1", reason: "Esnaf vazgecti", actor: { userId: "a1", ip: null } });

  it("yalnizca talebin kapattigi ve o andan beri degismemis dukkanlari acar", async () => {
    const later = new Date("2026-11-25T12:00:00.000Z");
    m.db.accountDeletionRequest.findUnique.mockResolvedValue({
      id: "r1",
      userId: "p1",
      status: "PENDING",
      deactivatedShops: [
        { id: "s1", updatedAt: STAMP.toISOString() },
        { id: "s2", updatedAt: STAMP.toISOString() },
      ],
    });
    // s2'yi yonetici bekleme suresinde duzenledi/kapatti: damga degisti.
    m.db.shop.findMany.mockResolvedValue([
      { id: "s1", name: "Kadikoy", updatedAt: STAMP },
      { id: "s2", name: "Besiktas", updatedAt: later },
    ]);
    await expect(cancel()).resolves.toEqual({ ok: true });
    expect(m.db.shop.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["s1", "s2"] }, ownerId: "p1", isActive: false } }),
    );
    expect(m.db.shop.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["s1"] } }, data: { isActive: true } });
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "account.deletion_cancelled", metadata: expect.objectContaining({ reopenedShops: ["s1"] }) }),
    );
  });

  it("tamamlama sahiplendiyse iptal 0 satir gorur ve dukkan acmaz", async () => {
    m.db.accountDeletionRequest.findUnique.mockResolvedValue({ id: "r1", userId: "p1", status: "PENDING", deactivatedShops: [] });
    m.db.accountDeletionRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(cancel()).resolves.toEqual({ ok: false, reason: "not_pending" });
    expect(m.db.shop.updateMany).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });

  it("gerekce kisaysa reddeder", async () => {
    await expect(
      accountPrivacyService.cancelDeletionRequest({ requestId: "r1", reason: "x", actor: { userId: "a1", ip: null } }),
    ).resolves.toEqual({ ok: false, reason: "invalid_reason" });
  });
});

describe("listDeletionRequests", () => {
  it("iptalde acilacak dukkanlari listeler", async () => {
    m.db.accountDeletionRequest.findMany.mockResolvedValue([
      {
        id: "r1",
        userId: "p1",
        status: "PENDING",
        deactivatedShops: [{ id: "s1", updatedAt: STAMP.toISOString() }],
        user: { id: "p1", name: "Ayse", email: null, phone: null },
      },
    ]);
    m.db.shop.findMany.mockResolvedValue([{ id: "s1", name: "Kadikoy", updatedAt: STAMP }]);
    const [row] = await accountPrivacyService.listDeletionRequests();
    expect(row.reopenShops).toEqual([{ id: "s1", name: "Kadikoy" }]);
    expect(row.blockers).toEqual({ activeBookings: 0, pendingPayouts: 0 });
  });
});
