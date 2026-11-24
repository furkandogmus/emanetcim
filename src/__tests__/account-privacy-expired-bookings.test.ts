import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Suresi dolmus (valizi hic birakilmamis, alma saati gecmis) rezervasyon hesap
 * silmeyi ENGELLEMEZ; silme sirasinda `expired_no_dropoff` ile kapanir.
 */

const m = vi.hoisted(() => {
  const ok = () => vi.fn().mockReturnValue(Promise.resolve({}));
  return {
    prisma: {
      booking: { count: vi.fn(), updateMany: ok() },
      session: { deleteMany: ok() },
      account: { deleteMany: ok() },
      review: { deleteMany: ok(), updateMany: ok() },
      legalAcceptance: { deleteMany: ok() },
      pushSubscription: { deleteMany: ok() },
      mobilePushToken: { deleteMany: ok() },
      reviewReport: { deleteMany: ok(), findMany: vi.fn().mockResolvedValue([]) },
      merchantProfile: { deleteMany: ok() },
      reviewBlock: { deleteMany: ok() },
      mobileInstall: { deleteMany: ok() },
      shopMember: { deleteMany: ok() },
      bagPhoto: { updateMany: ok() },
      shopInvite: { deleteMany: ok() },
      user: { update: ok(), findUnique: vi.fn().mockResolvedValue({ email: "Ada@Example.com" }) },
      passwordResetCode: { deleteMany: ok() },
      mobileLoginCode: { deleteMany: ok() },
      verificationToken: { deleteMany: ok() },
      $transaction: vi.fn().mockResolvedValue([]),
    },
    closeExpired: vi.fn(),
    collect: vi.fn().mockResolvedValue([{ c: "com.bagajpark", r: "rt" }]),
    revoke: vi.fn().mockResolvedValue(1),
  };
});

vi.mock("@/lib/db", () => ({ default: m.prisma }));
vi.mock("@/services/AppleTokenService", () => ({ appleTokenService: { collectForUser: m.collect, revokeTokens: m.revoke } }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/services/booking/closure", () => ({ closeExpiredBookingsForGuest: m.closeExpired }));

import { accountPrivacyService } from "@/services/AccountPrivacyService";

beforeEach(() => {
  vi.clearAllMocks();
  m.closeExpired.mockResolvedValue(1);
  m.prisma.$transaction.mockImplementation(async (fn: unknown) =>
    typeof fn === "function" ? (fn as (tx: typeof m.prisma) => unknown)(m.prisma) : [],
  );
});

describe("hesap silme ve suresi dolmus rezervasyonlar", () => {
  it("aktif sayimi suresi dolmuslari disarida birakir, sonra onlari kapatir", async () => {
    m.prisma.booking.count.mockResolvedValue(0);
    const r = await accountPrivacyService.anonymizeSelf({ userId: "g1", role: "GUEST", ip: null });
    expect(r).toEqual({ ok: true });
    const { where } = m.prisma.booking.count.mock.calls[0][0];
    expect(where.NOT.status.in.sort()).toEqual(["APPROVED", "PAID", "PENDING", "WAITING_APPROVAL"]);
    expect(where.NOT.checkOutTime.lt).toBeInstanceOf(Date);
    expect(m.closeExpired).toHaveBeenCalledWith("g1", expect.any(Date));
    expect(m.prisma.$transaction).toHaveBeenCalled();
  });

  it("Apple token'lari satirlar silinmeden okunur, silme bitince iptal edilir (5.1.1(v))", async () => {
    m.prisma.booking.count.mockResolvedValue(0);
    await accountPrivacyService.anonymizeSelf({ userId: "g1", role: "GUEST", ip: null });
    expect(m.collect).toHaveBeenCalledWith("g1");
    expect(m.revoke).toHaveBeenCalledWith("g1", [{ c: "com.bagajpark", r: "rt" }]);
    const tx = m.prisma.$transaction.mock.invocationCallOrder[0];
    expect(m.collect.mock.invocationCallOrder[0]).toBeLessThan(tx);
    expect(m.revoke.mock.invocationCallOrder[0]).toBeGreaterThan(tx);
  });

  it("gercekten aktif rezervasyon varsa hicbir sey kapatilmaz", async () => {
    m.prisma.booking.count.mockResolvedValue(1);
    const r = await accountPrivacyService.anonymizeSelf({ userId: "g1", role: "GUEST", ip: null });
    expect(r).toEqual({ ok: false, reason: "active_bookings" });
    expect(m.closeExpired).not.toHaveBeenCalled();
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("e-postaya bagli sifirlama kodu ve token satirlari da silinir", async () => {
    m.prisma.booking.count.mockResolvedValue(0);
    await accountPrivacyService.anonymizeSelf({ userId: "g1", role: "GUEST", ip: null });
    expect(m.prisma.passwordResetCode.deleteMany).toHaveBeenCalledWith({ where: { email: "ada@example.com" } });
    expect(m.prisma.mobileLoginCode.deleteMany).toHaveBeenCalledWith({ where: { identity: "ada@example.com" } });
    expect(m.prisma.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: { in: ["ada@example.com", "password-reset:ada@example.com"] } },
    });
  });

  it("telefon kimlikli kodla giris satiri da silinir", async () => {
    m.prisma.booking.count.mockResolvedValue(0);
    m.prisma.user.findUnique.mockResolvedValueOnce({ email: null, phone: "+905550000000" });
    await accountPrivacyService.anonymizeSelf({ userId: "g1", role: "GUEST", ip: null });
    expect(m.prisma.mobileLoginCode.deleteMany).toHaveBeenCalledWith({ where: { identity: "5550000000" } });
  });

  it("kullanicinin acik bildirimleri yorumlarin kuyruk sayacindan duser", async () => {
    m.prisma.booking.count.mockResolvedValue(0);
    m.prisma.reviewReport.findMany.mockResolvedValueOnce([{ reviewId: "r1" }, { reviewId: "r2" }]);
    await accountPrivacyService.anonymizeSelf({ userId: "g1", role: "GUEST", ip: null });
    expect(m.prisma.review.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["r1", "r2"] }, openReportCount: { gt: 0 } },
      data: { openReportCount: { decrement: 1 } },
    });
    expect(m.prisma.reviewReport.deleteMany).toHaveBeenCalledWith({ where: { userId: "g1" } });
  });
});
