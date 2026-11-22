import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Suresi dolmus (valizi hic birakilmamis, alma saati gecmis) rezervasyon hesap
 * silmeyi ENGELLEMEZ; silme sirasinda `expired_no_dropoff` ile kapanir.
 */

const m = vi.hoisted(() => {
  const ok = () => vi.fn().mockReturnValue(Promise.resolve({}));
  return {
    prisma: {
      booking: { count: vi.fn() },
      session: { deleteMany: ok() },
      account: { deleteMany: ok() },
      review: { deleteMany: ok() },
      legalAcceptance: { deleteMany: ok() },
      pushSubscription: { deleteMany: ok() },
      mobilePushToken: { deleteMany: ok() },
      mobileInstall: { deleteMany: ok() },
      user: { update: ok(), findUnique: vi.fn().mockResolvedValue({ email: "Ada@Example.com" }) },
      passwordResetCode: { deleteMany: ok() },
      verificationToken: { deleteMany: ok() },
      $transaction: vi.fn().mockResolvedValue([]),
    },
    closeExpired: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ default: m.prisma }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/services/booking/closure", () => ({ closeExpiredBookingsForGuest: m.closeExpired }));

import { accountPrivacyService } from "@/services/AccountPrivacyService";

beforeEach(() => {
  vi.clearAllMocks();
  m.closeExpired.mockResolvedValue(1);
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
    expect(m.prisma.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: { in: ["ada@example.com", "password-reset:ada@example.com"] } },
    });
  });
});
