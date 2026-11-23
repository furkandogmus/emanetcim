import { beforeEach, describe, expect, it, vi } from "vitest";

/** Esnaf/yonetici hesap silme talebi (App Store 5.1.1(v)): talep, tamamlama, iptal. */

const m = vi.hoisted(() => {
  const ok = () => vi.fn().mockResolvedValue({});
  const tx = {
    shop: { findMany: vi.fn(), updateMany: ok() },
    accountDeletionRequest: { upsert: ok(), updateMany: vi.fn() },
  };
  return {
    tx,
    prisma: {
      user: { findUnique: vi.fn(), count: vi.fn(), update: ok() },
      booking: { count: vi.fn().mockResolvedValue(0) },
      paymentSplit: { count: vi.fn().mockResolvedValue(0) },
      accountDeletionRequest: { findUnique: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
      session: { deleteMany: ok() },
      account: { deleteMany: ok() },
      review: { deleteMany: ok() },
      reviewReport: { deleteMany: ok() },
      reviewBlock: { deleteMany: ok() },
      legalAcceptance: { deleteMany: ok() },
      pushSubscription: { deleteMany: ok() },
      mobilePushToken: { deleteMany: ok() },
      mobileInstall: { deleteMany: ok() },
      passwordResetCode: { deleteMany: ok() },
      verificationToken: { deleteMany: ok() },
      $transaction: vi.fn(),
    },
    audit: vi.fn(),
    notifyAdmins: vi.fn().mockResolvedValue(undefined),
    completedEmail: vi.fn().mockResolvedValue(undefined),
    revoke: vi.fn().mockResolvedValue(0),
  };
});

vi.mock("@/lib/db", () => ({ default: m.prisma }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: m.audit }));
vi.mock("@/services/booking/closure", () => ({ closeExpiredBookingsForGuest: vi.fn().mockResolvedValue(0) }));
vi.mock("@/services/AppleTokenService", () => ({ appleTokenService: { revokeForUser: m.revoke } }));
vi.mock("@/services/NotificationService", () => ({
  notificationService: {
    notifyAdminsForDeletionRequest: m.notifyAdmins,
    sendAccountDeletionCompleted: m.completedEmail,
  },
}));

import { ACCOUNT_DELETION_SLA_DAYS, accountPrivacyService } from "@/services/AccountPrivacyService";

const PARTNER = { id: "p1", name: "Ayse", email: "ayse@example.com", accountDeletionRequest: null };

beforeEach(() => {
  vi.clearAllMocks();
  m.prisma.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function" ? (arg as (t: typeof m.tx) => unknown)(m.tx) : [],
  );
  m.prisma.booking.count.mockResolvedValue(0);
  m.prisma.paymentSplit.count.mockResolvedValue(0);
  m.tx.shop.findMany.mockResolvedValue([{ id: "s1" }, { id: "s2" }]);
  m.tx.accountDeletionRequest.updateMany.mockResolvedValue({ count: 1 });
});

describe("requestDeletion", () => {
  it("esnaf: talep acilir, dukkanlar yeni rezervasyona kapanir, yoneticiye haber gider", async () => {
    m.prisma.user.findUnique.mockResolvedValue(PARTNER);
    const r = await accountPrivacyService.requestDeletion({ userId: "p1", role: "PARTNER", ip: null, locale: "en" });

    expect(r).toMatchObject({ ok: true, alreadyPending: false, slaDays: ACCOUNT_DELETION_SLA_DAYS });
    if (!r.ok) throw new Error("unreachable");
    const days = (r.dueAt.getTime() - Date.now()) / 86_400_000;
    expect(Math.round(days)).toBe(30);
    expect(m.tx.shop.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["s1", "s2"] } }, data: { isActive: false } });
    const upsert = m.tx.accountDeletionRequest.upsert.mock.calls[0][0];
    expect(upsert.create).toMatchObject({
      userId: "p1",
      status: "PENDING",
      contactEmail: "ayse@example.com",
      contactLocale: "en",
      deactivatedShopIds: ["s1", "s2"],
    });
    expect(m.notifyAdmins).toHaveBeenCalledWith(expect.objectContaining({ name: "Ayse", role: "PARTNER" }));
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "account.deletion_requested" }));
  });

  it("bekleyen talep varsa yenisini acmaz, ayni son gunu doner", async () => {
    const dueAt = new Date("2026-12-23T00:00:00Z");
    m.prisma.user.findUnique.mockResolvedValue({ ...PARTNER, accountDeletionRequest: { status: "PENDING", dueAt } });
    const r = await accountPrivacyService.requestDeletion({ userId: "p1", role: "PARTNER", ip: null });
    expect(r).toEqual({ ok: true, alreadyPending: true, dueAt, slaDays: 30 });
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
    expect(m.notifyAdmins).not.toHaveBeenCalled();
  });

  it("misafir talep acmaz (aninda silme yolu var)", async () => {
    const r = await accountPrivacyService.requestDeletion({ userId: "g1", role: "GUEST", ip: null });
    expect(r).toEqual({ ok: false, reason: "guest_use_delete" });
  });

  it("son yonetici talep acamaz", async () => {
    m.prisma.user.findUnique.mockResolvedValue({ ...PARTNER, id: "a1" });
    m.prisma.user.count.mockResolvedValue(0);
    const r = await accountPrivacyService.requestDeletion({ userId: "a1", role: "ADMIN", ip: null });
    expect(r).toEqual({ ok: false, reason: "last_admin" });
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("baska yonetici varsa yonetici de talep acar", async () => {
    m.prisma.user.findUnique.mockResolvedValue({ ...PARTNER, id: "a1" });
    m.prisma.user.count.mockResolvedValue(1);
    m.tx.shop.findMany.mockResolvedValue([]);
    const r = await accountPrivacyService.requestDeletion({ userId: "a1", role: "ADMIN", ip: null });
    expect(r.ok).toBe(true);
    expect(m.tx.shop.updateMany).not.toHaveBeenCalled();
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
    deactivatedShopIds: ["s1"],
  };

  it("engel yoksa ayni silme govdesiyle anonimlestirir ve e-posta gonderir", async () => {
    m.prisma.accountDeletionRequest.findUnique.mockResolvedValue(REQ);
    m.prisma.user.findUnique.mockResolvedValue({ email: "ayse@example.com" });
    m.prisma.accountDeletionRequest.updateMany.mockResolvedValue({ count: 1 });

    const r = await accountPrivacyService.completeDeletionRequest({ requestId: "r1", actor: { userId: "a1", ip: null } });
    expect(r).toEqual({ ok: true });
    expect(m.revoke).toHaveBeenCalledWith("p1");
    expect(m.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p1" }, data: expect.objectContaining({ tokenVersion: { increment: 1 } }) }),
    );
    expect(m.prisma.accountDeletionRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "r1", status: "PENDING" },
      data: expect.objectContaining({ status: "COMPLETED", resolvedById: "a1", contactEmail: null }),
    });
    expect(m.completedEmail).toHaveBeenCalledWith("ayse@example.com", "en");
  });

  it("dukkanda aktif rezervasyon ya da bekleyen hakedis varsa tamamlanmaz", async () => {
    m.prisma.accountDeletionRequest.findUnique.mockResolvedValue(REQ);
    m.prisma.booking.count.mockResolvedValueOnce(0).mockResolvedValueOnce(2);
    await expect(
      accountPrivacyService.completeDeletionRequest({ requestId: "r1", actor: { userId: "a1", ip: null } }),
    ).resolves.toEqual({ ok: false, reason: "active_bookings" });

    m.prisma.paymentSplit.count.mockResolvedValueOnce(1);
    await expect(
      accountPrivacyService.completeDeletionRequest({ requestId: "r1", actor: { userId: "a1", ip: null } }),
    ).resolves.toEqual({ ok: false, reason: "pending_payouts" });
    expect(m.prisma.user.update).not.toHaveBeenCalled();
  });

  it("yonetici kendi talebini tamamlayamaz; bitmis talep tekrar islenmez", async () => {
    m.prisma.accountDeletionRequest.findUnique.mockResolvedValue({ ...REQ, userId: "a1" });
    await expect(
      accountPrivacyService.completeDeletionRequest({ requestId: "r1", actor: { userId: "a1", ip: null } }),
    ).resolves.toEqual({ ok: false, reason: "cannot_delete_self" });
    m.prisma.accountDeletionRequest.findUnique.mockResolvedValue({ ...REQ, status: "COMPLETED" });
    await expect(
      accountPrivacyService.completeDeletionRequest({ requestId: "r1", actor: { userId: "a1", ip: null } }),
    ).resolves.toEqual({ ok: false, reason: "not_pending" });
  });
});

describe("cancelDeletionRequest", () => {
  it("kapatilan dukkanlari yeniden acar ve gerekceyi denetime yazar", async () => {
    m.prisma.accountDeletionRequest.findUnique.mockResolvedValue({
      id: "r1",
      userId: "p1",
      status: "PENDING",
      deactivatedShopIds: ["s1"],
    });
    const r = await accountPrivacyService.cancelDeletionRequest({
      requestId: "r1",
      reason: "Esnaf vazgecti",
      actor: { userId: "a1", ip: null },
    });
    expect(r).toEqual({ ok: true });
    expect(m.tx.shop.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["s1"] }, ownerId: "p1" },
      data: { isActive: true },
    });
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "account.deletion_cancelled", metadata: { requestId: "r1", reason: "Esnaf vazgecti" } }),
    );
  });

  it("gerekce kisaysa reddeder", async () => {
    await expect(
      accountPrivacyService.cancelDeletionRequest({ requestId: "r1", reason: "x", actor: { userId: "a1", ip: null } }),
    ).resolves.toEqual({ ok: false, reason: "invalid_reason" });
  });
});
