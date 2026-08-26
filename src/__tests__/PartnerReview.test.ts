import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Esnaf onay/red GOVDESI — web action'i ve mobil ucun ORTAK yolu.
 *
 * NEDEN BU DOSYA VAR (2026-08-25): bu iki islem iki ayri yerde yazilmisti ve
 * kopyalar sessizce ayrismisti. En pahalisi RED'di: web `cancelBooking()`
 * cagiriyordu (iade + `ReservationSlot` silme + sadakat puani geri alma), mobil
 * ise ham `prisma.booking.update({ status: CANCELLED })` yaziyordu — yani
 * reddedilen rezervasyon dukkanin kapasitesini KALICI olarak tutuyordu ve
 * odeme defterinde acik satir birakiyordu.
 *
 * Buradaki testler govdeyi dogrudan sinar; iki tasiyicinin de ayni yoldan
 * gectigini `service-layer-writes.test.ts` mandali garanti eder.
 */

const { mockPrisma, mockCancelBooking, mockEvents, mockNotifications } = vi.hoisted(() => ({
  mockPrisma: {
    booking: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  mockCancelBooking: vi.fn(),
  mockEvents: { record: vi.fn().mockResolvedValue(undefined) },
  mockNotifications: {
    notifyBookingApproved: vi.fn().mockResolvedValue(undefined),
    notifyBookingCancelled: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/services/booking/lifecycle", () => ({ cancelBooking: mockCancelBooking }));
vi.mock("@/services/BookingEventService", () => ({ bookingEventService: mockEvents }));
vi.mock("@/services/NotificationService", () => ({ notificationService: mockNotifications }));

import { approveBooking, rejectBooking } from "@/services/booking/partner-review";

const OWNER = { id: "owner-1", role: "PARTNER" as const };
const ADMIN = { id: "admin-1", role: "ADMIN" as const };

function booking(status: string, ownerId = "owner-1") {
  return {
    id: "b1",
    shopId: "shop-1",
    status,
    shop: { ownerId, name: "Test Dükkan" },
    guest: { email: "misafir@ornek.com" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCancelBooking.mockResolvedValue({ ok: true, fullRefund: false });
  mockPrisma.booking.updateMany.mockResolvedValue({ count: 1 });
});

describe("approveBooking", () => {
  it("ONAY BEKLEYEN talebi onaylar ve sürümü artırır", async () => {
    mockPrisma.booking.findUnique.mockResolvedValue(booking("WAITING_APPROVAL"));

    const result = await approveBooking("b1", OWNER, { locale: "tr" });

    expect(result).toEqual({ ok: true });
    const call = mockPrisma.booking.updateMany.mock.calls[0][0];
    // Durum kosulu `where`'de: iki esnaf ayni anda onaylarsa ikincisi eli bos doner.
    expect(call.where.status).toBe("WAITING_APPROVAL");
    expect(call.data.bookingRowVersion).toEqual({ increment: 1 });
  });

  it("yarışı kaybeden ikinci onay INVALID_STATUS alır, bildirim GİTMEZ", async () => {
    mockPrisma.booking.findUnique.mockResolvedValue(booking("WAITING_APPROVAL"));
    mockPrisma.booking.updateMany.mockResolvedValue({ count: 0 });

    const result = await approveBooking("b1", OWNER);

    expect(result).toEqual({ ok: false, code: "INVALID_STATUS" });
    expect(mockNotifications.notifyBookingApproved).not.toHaveBeenCalled();
  });

  it("başka bir esnafın dükkanına dokunamaz", async () => {
    mockPrisma.booking.findUnique.mockResolvedValue(booking("WAITING_APPROVAL", "baska-owner"));

    expect(await approveBooking("b1", OWNER)).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(mockPrisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it("bildirim dili ÇAĞIRANDAN gelir — mobil uç `en` sabitliyordu", async () => {
    mockPrisma.booking.findUnique.mockResolvedValue(booking("WAITING_APPROVAL"));

    await approveBooking("b1", OWNER, { locale: "ja" });

    expect(mockNotifications.notifyBookingApproved).toHaveBeenCalledWith(
      "misafir@ornek.com",
      "b1",
      "Test Dükkan",
      "ja",
    );
  });
});

describe("rejectBooking", () => {
  it("iptali cancelBooking'e devreder — HAM update YAZMAZ", async () => {
    // Bu, mobil ucun 2026-08-25'e kadar tasidigi hatanin ta kendisi: ham
    // `status = CANCELLED` yazmak iadeyi atlar ve slotlari serbest birakmaz.
    mockPrisma.booking.findUnique.mockResolvedValue(booking("WAITING_APPROVAL"));

    const result = await rejectBooking("b1", OWNER, { locale: "tr" });

    expect(result).toEqual({ ok: true });
    expect(mockCancelBooking).toHaveBeenCalledWith("b1");
    expect(mockPrisma.booking.update).not.toHaveBeenCalled();
    expect(mockPrisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it("esnaf ONAYLANMIŞ rezervasyonu reddedemez, admin edebilir", async () => {
    mockPrisma.booking.findUnique.mockResolvedValue(booking("APPROVED"));
    expect(await rejectBooking("b1", OWNER)).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(mockCancelBooking).not.toHaveBeenCalled();

    mockPrisma.booking.findUnique.mockResolvedValue(booking("APPROVED"));
    expect(await rejectBooking("b1", ADMIN)).toEqual({ ok: true });
    expect(mockCancelBooking).toHaveBeenCalledWith("b1");
  });

  it("PAID / CHECKED_IN gibi durumlarda reddi engeller", async () => {
    for (const status of ["PAID", "CHECKED_IN", "CHECKED_OUT", "CANCELLED"]) {
      vi.clearAllMocks();
      mockPrisma.booking.findUnique.mockResolvedValue(booking(status));

      expect(await rejectBooking("b1", ADMIN), status).toEqual({
        ok: false,
        code: "INVALID_STATUS",
      });
      expect(mockCancelBooking).not.toHaveBeenCalled();
    }
  });

  it("cancelBooking reddederse iptal BAŞARILI sayılmaz", async () => {
    mockPrisma.booking.findUnique.mockResolvedValue(booking("WAITING_APPROVAL"));
    mockCancelBooking.mockResolvedValue({ ok: false, code: "INVALID_STATUS", message: "x" });

    expect(await rejectBooking("b1", OWNER)).toEqual({ ok: false, code: "INVALID_STATUS" });
    expect(mockNotifications.notifyBookingCancelled).not.toHaveBeenCalled();
  });

  it("olmayan rezervasyon NOT_FOUND", async () => {
    mockPrisma.booking.findUnique.mockResolvedValue(null);
    expect(await rejectBooking("yok", OWNER)).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("denetim izine kim reddetti yazılır", async () => {
    mockPrisma.booking.findUnique.mockResolvedValue(booking("WAITING_APPROVAL"));
    await rejectBooking("b1", OWNER);

    expect(mockEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "CANCELLED",
        actorId: "owner-1",
        actorRole: "PARTNER",
        metadata: { reason: "rejected_by_partner" },
      }),
    );
  });
});
