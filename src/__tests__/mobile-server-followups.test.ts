import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mobil denetim (2026-11) sunucu takipleri: yonetici goruntuleme izi (65),
 * cikista bildirim kaydi temizligi (125), iptalde bekleyen oneri (57).
 */
const { db } = vi.hoisted(() => ({
  db: {
    bookingEvent: { create: vi.fn() },
    user: { update: vi.fn() },
    session: { deleteMany: vi.fn() },
    mobilePushToken: { deleteMany: vi.fn() },
    paymentLog: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
  },
}));
vi.mock("@/lib/db", () => ({ default: db }));

import { bookingEventService } from "@/services/BookingEventService";
import { revokeAllUserSessions } from "@/services/auth/mobile-session";
import { PaymentService } from "@/services/PaymentService";
import { ManualPaymentProvider } from "@/lib/payments";

beforeEach(() => {
  vi.clearAllMocks();
  db.bookingEvent.create.mockResolvedValue({});
});

describe("yonetici goruntuleme izi (bulgu 65)", () => {
  it("olay satiri goruntulenen kullaniciyi ve dugmeye basan yoneticiyi birlikte yazar", async () => {
    await bookingEventService.record({
      bookingId: "b1",
      event: "CHECKED_IN",
      actorId: "partner-1",
      actorRole: "PARTNER",
      impersonatedBy: "admin-1",
      metadata: { previousStatus: "APPROVED" },
    });
    const { data } = db.bookingEvent.create.mock.calls[0][0];
    expect(data.actorId).toBe("partner-1");
    expect(data.metadata).toEqual({ previousStatus: "APPROVED", impersonatedBy: "admin-1" });
  });

  it("goruntuleme yoksa metadata degismez", async () => {
    await bookingEventService.record({ bookingId: "b1", event: "CHECKED_IN", metadata: { a: 1 } });
    expect(db.bookingEvent.create.mock.calls[0][0].data.metadata).toEqual({ a: 1 });
  });

  it("defter denetim satiri da yoneticiyi tasir", async () => {
    db.paymentLog.findUnique.mockResolvedValue({ id: "p1", status: "PENDING" });
    db.paymentLog.update.mockResolvedValue({});
    const svc = new PaymentService(new ManualPaymentProvider());
    await svc.cancelIntent({
      bookingId: "b1",
      actor: { id: "guest-1", role: "GUEST", impersonatedBy: "admin-1" },
    });
    const { data } = db.bookingEvent.create.mock.calls[0][0];
    expect(data.actorId).toBe("guest-1");
    expect(data.metadata).toMatchObject({ payment: "intent_cancelled", impersonatedBy: "admin-1" });
  });
});

describe("revokeAllUserSessions (bulgu 125)", () => {
  it("oturumlarla birlikte cihaz bildirim kayitlarini da siler", async () => {
    await revokeAllUserSessions("u1");
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { tokenVersion: { increment: 1 } },
    });
    expect(db.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(db.mobilePushToken.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
  });
});
