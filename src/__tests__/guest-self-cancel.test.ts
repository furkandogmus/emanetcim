import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Misafirin kendi iptal yollari (web `cancelBookingAction`, mobil
 * `DELETE /api/mobile/bookings/[id]/cancel`):
 *   - yonetici BASKASININ rezervasyonunu buradan iptal EDEMEZ (forbidden):
 *     yolu zorunlu aciklamali ve denetim kayitli yonetici iptalidir;
 *   - goruntuleme oturumu (aktor misafirin kendisi) iptal edebilir;
 *   - alma saati gecmis (suresi dolmus) APPROVED kayit kapatilabilir: neden
 *     `expired_no_dropoff`, esnafa "iptal edildi" push'u gitmez;
 *   - suresi dolmamis kayitta normal `guest_cancel`, esnaf haberdar edilir.
 * Servis zinciri gercek; yalniz Prisma ve yan etkiler sahte.
 */

const m = vi.hoisted(() => ({
  prisma: {
    booking: { findUnique: vi.fn(), updateMany: vi.fn() },
    paymentLog: { findFirst: vi.fn() },
    reservationSlot: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
  sessionUser: null as null | { id: string; role: string },
  mobileUser: { id: "g1", role: "GUEST" } as { id: string; role: string; impersonatedBy?: string },
}));

vi.mock("@/lib/db", () => ({ default: m.prisma }));
vi.mock("@/auth", () => ({ auth: vi.fn(async () => (m.sessionUser ? { user: m.sessionUser } : null)) }));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: vi.fn() }));
vi.mock("@/lib/mobile-auth", () => ({
  requireMobileUser: vi.fn(async () => ({ user: m.mobileUser })),
  requireRole: vi.fn(() => null),
}));
vi.mock("@/services/BookingEventService", () => ({ bookingEventService: { record: vi.fn(async () => undefined) } }));
vi.mock("@/services/PaymentService", () => ({
  paymentService: { refund: vi.fn(async () => ({ ok: true })), cancelIntent: vi.fn(async () => undefined) },
}));
vi.mock("@/services/CouponService", () => ({ couponService: { releaseByCode: vi.fn(async () => undefined) } }));
vi.mock("@/services/NotificationService", () => ({
  notificationService: {
    notifyPartnerBookingChange: vi.fn(async () => undefined),
    notifyGuestBookingClosed: vi.fn(async () => undefined),
    notifyPartnerAdminAction: vi.fn(async () => undefined),
  },
}));

import { cancelBookingAction } from "@/actions/booking";
import { DELETE } from "@/app/api/mobile/bookings/[id]/cancel/route";

const EXPIRED = {
  id: "b1",
  guestId: "g1",
  status: "APPROVED",
  checkInTime: new Date("2020-01-01T09:00:00Z"),
  checkOutTime: new Date("2020-01-01T18:00:00Z"),
  couponCode: null,
  locale: "tr",
  reservationSlots: [],
  shop: { ownerId: "owner-1", owner: { id: "owner-1" } },
  guest: { id: "g1" },
};

const FUTURE = {
  checkInTime: new Date("2099-01-01T09:00:00Z"),
  checkOutTime: new Date("2099-01-01T18:00:00Z"),
};

const del = async () => {
  const res = await DELETE(new NextRequest("http://localhost/x", { method: "DELETE" }), {
    params: Promise.resolve({ id: "b1" }),
  });
  if (!res) throw new Error("yanit yok");
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
  m.prisma.booking.findUnique.mockResolvedValue(EXPIRED);
  m.prisma.booking.updateMany.mockResolvedValue({ count: 1 });
  m.prisma.paymentLog.findFirst.mockResolvedValue(null);
  m.prisma.$transaction.mockImplementation(async (f: (tx: unknown) => unknown) => f(m.prisma));
  m.sessionUser = { id: "g1", role: "GUEST" };
  m.mobileUser = { id: "g1", role: "GUEST" };
});

describe("web cancelBookingAction", () => {
  it("misafir suresi dolmus kendi rezervasyonunu kapatir (expired_no_dropoff, esnafa bildirim yok)", async () => {
    expect(await cancelBookingAction("b1")).toMatchObject({ success: true });
    const { bookingEventService } = await import("@/services/BookingEventService");
    expect(bookingEventService.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: "CANCELLED", metadata: expect.objectContaining({ reason: "expired_no_dropoff" }) }),
    );
    const { notificationService } = await import("@/services/NotificationService");
    expect(notificationService.notifyPartnerBookingChange).not.toHaveBeenCalled();
  });

  it("suresi dolmamis rezervasyonda guest_cancel ve esnafa bildirim", async () => {
    m.prisma.booking.findUnique.mockResolvedValue({ ...EXPIRED, ...FUTURE });
    expect(await cancelBookingAction("b1")).toMatchObject({ success: true });
    const { bookingEventService } = await import("@/services/BookingEventService");
    expect(bookingEventService.record).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ reason: "guest_cancel" }) }),
    );
    const { notificationService } = await import("@/services/NotificationService");
    expect(notificationService.notifyPartnerBookingChange).toHaveBeenCalled();
  });

  it("yonetici baskasinin rezervasyonunu buradan iptal edemez", async () => {
    m.sessionUser = { id: "admin-1", role: "ADMIN" };
    expect(await cancelBookingAction("b1")).toEqual({ success: false, error: "Errors.unauthorized" });
    expect(m.prisma.booking.updateMany).not.toHaveBeenCalled();
  });
});

describe("mobil DELETE /bookings/[id]/cancel", () => {
  it("misafir suresi dolmus kendi rezervasyonunu kapatir (expired_no_dropoff, esnafa bildirim yok)", async () => {
    const res = await del();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
    const { bookingEventService } = await import("@/services/BookingEventService");
    expect(bookingEventService.record).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ reason: "expired_no_dropoff" }) }),
    );
    const { notificationService } = await import("@/services/NotificationService");
    expect(notificationService.notifyPartnerBookingChange).not.toHaveBeenCalled();
  });

  it("suresi dolmamis rezervasyonda guest_cancel", async () => {
    m.prisma.booking.findUnique.mockResolvedValue({ ...EXPIRED, ...FUTURE });
    expect((await del()).status).toBe(200);
    const { bookingEventService } = await import("@/services/BookingEventService");
    expect(bookingEventService.record).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ reason: "guest_cancel" }) }),
    );
  });

  it("yonetici baskasinin rezervasyonunda 403 forbidden", async () => {
    m.mobileUser = { id: "admin-1", role: "ADMIN" };
    const res = await del();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
    expect(m.prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it("esnaf da bu yoldan iptal edemez", async () => {
    m.mobileUser = { id: "owner-1", role: "PARTNER" };
    expect((await del()).status).toBe(403);
  });

  it("goruntuleme oturumu (aktor misafirin kendisi) misafir iptalidir", async () => {
    m.prisma.booking.findUnique.mockResolvedValue({ ...EXPIRED, ...FUTURE });
    m.mobileUser = { id: "g1", role: "GUEST", impersonatedBy: "admin-1" };
    const res = await del();
    expect(res.status).toBe(200);
    const { bookingEventService } = await import("@/services/BookingEventService");
    expect(bookingEventService.record).toHaveBeenCalledWith(
      expect.objectContaining({ impersonatedBy: "admin-1", metadata: expect.objectContaining({ reason: "guest_cancel" }) }),
    );
  });
});
