import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * MISAFIR IPTALI VE DEGISIKLIGI SESSIZ DEGIL; DEGISTIRME PLATFORM TATILINI DE KONTROL EDER.
 *
 * - Iptal/degisiklik yalnizca `bookingEvent` yaziyordu: esnaf iptali ancak liste
 *   30 sn'de bir yenilenince goruyordu. Servis artik esnafa push, misafire iptal
 *   onayi push'u gonderir (web ve mobil ayni yolu kullanir).
 * - Esnafin "reddet"i `silent` gecer: misafir kendi bildirimini zaten aliyor.
 * - Platform tatili kurali yalnizca web action'indaydi; mobil degistirme
 *   rezervasyonu tatile tasiyabiliyordu.
 */

const m = vi.hoisted(() => ({
  prisma: {
    booking: { findUnique: vi.fn(), updateMany: vi.fn() },
    paymentLog: { findFirst: vi.fn() },
    reservationSlot: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
  notifyPartner: vi.fn(),
  notifyGuestClosed: vi.fn(),
  notifyPartnerAdmin: vi.fn(),
  holiday: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ default: m.prisma }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/tx-retry", () => ({ retryOnWriteConflict: (f: () => unknown) => f() }));
vi.mock("@/services/SlotService", () => ({
  reserveSlots: vi.fn(),
  releaseSlots: vi.fn(),
  SlotAvailabilityError: class extends Error {},
}));
vi.mock("@/lib/platform-settings", () => ({
  getPricingRules: vi.fn().mockResolvedValue({ platformHolidayDates: ["2030-01-02"], maxStayDays: 30 }),
}));
vi.mock("@/services/ShopScheduleService", () => ({
  findClosedStayDay: vi.fn().mockResolvedValue(null),
  isClosedAtStayTimes: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/booking-server-price", () => ({
  validateBookingStayWindow: () => true,
  computeAuthoritativeCheckoutTotals: vi.fn(),
  checkoutLineItems: vi.fn(),
}));
vi.mock("@/lib/booking-holidays", () => ({ bookingTouchesPlatformHoliday: m.holiday }));
vi.mock("@/services/BookingEventService", () => ({
  bookingEventService: { record: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("@/services/PaymentService", () => ({
  paymentService: {
    refund: vi.fn().mockResolvedValue({ ok: true }),
    cancelIntent: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/services/CouponService", () => ({ couponService: { releaseByCode: vi.fn() } }));
vi.mock("@/services/NotificationService", () => ({
  notificationService: {
    notifyPartnerBookingChange: m.notifyPartner,
    notifyGuestBookingClosed: m.notifyGuestClosed,
    notifyPartnerAdminAction: m.notifyPartnerAdmin,
  },
}));
vi.mock("@/services/booking/create", () => ({ assertCapacityTx: vi.fn() }));

import { cancelBooking, modifyBooking } from "@/services/booking/lifecycle";

describe("cancelBooking bildirimleri", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.notifyPartner.mockResolvedValue(undefined);
    m.notifyGuestClosed.mockResolvedValue(undefined);
    m.notifyPartnerAdmin.mockResolvedValue(undefined);
    m.prisma.booking.findUnique.mockResolvedValue({
      id: "b1",
      status: "APPROVED",
      couponCode: null,
      locale: "en",
      reservationSlots: [],
    });
    m.prisma.paymentLog.findFirst.mockResolvedValue(null);
    m.prisma.booking.updateMany.mockResolvedValue({ count: 1 });
    m.prisma.$transaction.mockImplementation(async (f: (tx: unknown) => unknown) => f(m.prisma));
  });

  it("misafir iptali esnafa ve misafire bildirim gonderir", async () => {
    const r = await cancelBooking("b1");
    expect(r.ok).toBe(true);
    expect(m.notifyPartner).toHaveBeenCalledWith({ bookingId: "b1", kind: "cancelled" });
    // Misafir push'a ek olarak e-posta da alir (eskiden yalniz push).
    expect(m.notifyGuestClosed).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: "b1", reason: "guest_cancel", locale: "en" }),
    );
  });

  it("silent iptal (esnafin reddi, toplu silme) bildirim gondermez", async () => {
    const r = await cancelBooking("b1", { silent: true });
    expect(r.ok).toBe(true);
    expect(m.notifyPartner).not.toHaveBeenCalled();
    expect(m.notifyGuestClosed).not.toHaveBeenCalled();
  });

  // Bulgu 57: iptal edilen kayitta onaylanamayacak bir valiz onerisi kalmasin.
  it("iptal bekleyen valiz onerisini ayni kosullu yazimda siler", async () => {
    await cancelBooking("b1");
    const { data } = m.prisma.booking.updateMany.mock.calls[0][0];
    expect(data.status).toBe("CANCELLED");
    expect(data).toHaveProperty("pendingBagRevision");
  });

  // Bulgu 65: yonetici goruntulemede yapilan iptal olay satirinda yoneticiyi tasir.
  it("aktor ve goruntuleyen yonetici olay kaydina ve deftere gecer", async () => {
    const { bookingEventService } = await import("@/services/BookingEventService");
    const { paymentService } = await import("@/services/PaymentService");
    const actor = { id: "g1", role: "GUEST" as const, impersonatedBy: "admin-1" };
    await cancelBooking("b1", { actor });
    expect(bookingEventService.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: "CANCELLED", actorId: "g1", impersonatedBy: "admin-1" }),
    );
    expect(paymentService.cancelIntent).toHaveBeenCalledWith({ bookingId: "b1", actor });
  });

  it("neden, alt neden ve aciklama CANCELLED olayina yazilir", async () => {
    const { bookingEventService } = await import("@/services/BookingEventService");
    await cancelBooking("b1", { reason: "partner_cancel", detail: "other", note: "su kesildi" });
    expect(bookingEventService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "CANCELLED",
        metadata: expect.objectContaining({ reason: "partner_cancel", detail: "other", note: "su kesildi" }),
      }),
    );
  });

  it("esnafin kendi iptalinde ve 'gelmedi'de esnafa push gitmez, misafire nedenli bildirim gider", async () => {
    for (const reason of ["partner_cancel", "no_show"] as const) {
      vi.clearAllMocks();
      m.prisma.booking.updateMany.mockResolvedValue({ count: 1 });
      m.notifyGuestClosed.mockResolvedValue(undefined);
      await cancelBooking("b1", { reason });
      expect(m.notifyPartner, reason).not.toHaveBeenCalled();
      expect(m.notifyGuestClosed).toHaveBeenCalledWith(expect.objectContaining({ reason }));
    }
  });

  it("yonetici iptali esnafa push + e-posta gonderir", async () => {
    await cancelBooking("b1", { reason: "admin_cancel", note: "misafir aradi" });
    expect(m.notifyPartner).toHaveBeenCalledWith({ bookingId: "b1", kind: "cancelled" });
    expect(m.notifyPartnerAdmin).toHaveBeenCalledWith({ bookingId: "b1", kind: "cancelled", note: "misafir aradi" });
  });

  it("kilit alindiktan sonra yan etki firlatsa da iptal BASARILI doner", async () => {
    // Rezervasyon artik CANCELLED; UNKNOWN donmek istemciyi tekrar denemeye ve `invalid_status`e iter.
    m.prisma.$transaction.mockRejectedValue(new Error("db down"));
    const { paymentService } = await import("@/services/PaymentService");
    vi.mocked(paymentService.cancelIntent).mockRejectedValueOnce(new Error("ledger down"));
    const r = await cancelBooking("b1");
    expect(r.ok).toBe(true);
    const { bookingEventService } = await import("@/services/BookingEventService");
    expect(bookingEventService.record).toHaveBeenCalledWith(expect.objectContaining({ event: "CANCELLED" }));
  });

  it("cift iptal: ikinci cagri kilidi kaybeder, olay ve bildirim bir kez", async () => {
    const { bookingEventService } = await import("@/services/BookingEventService");
    m.prisma.booking.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    expect((await cancelBooking("b1")).ok).toBe(true);
    expect(await cancelBooking("b1")).toMatchObject({ ok: false, code: "INVALID_STATUS" });
    expect(bookingEventService.record).toHaveBeenCalledTimes(1);
    expect(m.notifyGuestClosed).toHaveBeenCalledTimes(1);
  });

  it("basarisiz iptalde bildirim gitmez", async () => {
    m.prisma.booking.updateMany.mockResolvedValue({ count: 0 });
    await cancelBooking("b1");
    expect(m.notifyPartner).not.toHaveBeenCalled();
  });
});

describe("modifyBooking platform tatili", () => {
  it("tatile denk gelen aralik PLATFORM_HOLIDAY ile reddedilir", async () => {
    m.holiday.mockReturnValue(true);
    m.prisma.booking.findUnique.mockResolvedValue({
      id: "b1",
      shopId: "s1",
      guestId: "g1",
      status: "APPROVED",
      shop: {},
    });
    const r = await modifyBooking("b1", "g1", {
      checkInTime: new Date("2030-01-01T10:00:00Z"),
      checkOutTime: new Date("2030-01-03T10:00:00Z"),
      bagCountS: 1,
      bagCountM: 0,
      bagCountXl: 0,
    });
    expect(r).toMatchObject({ ok: false, code: "PLATFORM_HOLIDAY" });
  });
});
