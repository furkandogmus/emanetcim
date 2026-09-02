import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    /*
      `updateMany`: iptal hakki artik atomik aliniyor (2026-09-02) -- dort es
      zamanli iptal sadakat puanini DORT KEZ dusuruyordu. Sahte istemci
      varsayilan olarak "hakki aldim" (count: 1) donuyor; kaybeden yol ayri
      testte (`cancel-refund-race`).
    */
    booking: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    paymentLog: { findFirst: vi.fn() },
    reservationSlot: { deleteMany: vi.fn() },
    $transaction: vi.fn(async (fn: unknown) =>
      typeof fn === "function" ? (fn as (t: unknown) => unknown)({
        booking: { update: vi.fn() },
        reservationSlot: { deleteMany: vi.fn() },
      }) : undefined,
    ),
    $executeRaw: vi.fn().mockResolvedValue(1),
  },
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/services/PaymentService", () => ({
  paymentService: {
    refund: vi.fn().mockResolvedValue({ ok: true }),
    cancelIntent: vi.fn().mockResolvedValue({ ok: true }),
  },
}));
vi.mock("@/services/BookingEventService", () => ({
  bookingEventService: { record: vi.fn().mockResolvedValue(undefined) },
}));

import { cancelBooking } from "@/services/booking/lifecycle";

function booking(over: Record<string, unknown> = {}) {
  return {
    id: "b1", guestId: "g1", status: "APPROVED", totalPrice: 192,
    loyaltyPointsAwarded: 80, reservationSlots: [], ...over,
  };
}

beforeEach(() => {
    mockPrisma.booking.updateMany.mockResolvedValue({ count: 1 });
  vi.clearAllMocks();
  mockPrisma.paymentLog.findFirst.mockResolvedValue(null);
  mockPrisma.$executeRaw.mockResolvedValue(1);
});

/**
 * Sadakat puanı: iptal, VERİLEN kadar geri alır — güncel fiyattan değil.
 *
 * Ölçüldü (2026-09-01): 80 TRY rezervasyon +80 puan; valiz 1→3 düzeltilince
 * tutar 192 TRY; iptalde 192 puan silindi. Misafir BAŞKA rezervasyonlardan
 * kazandığı 112 puanı kaybetti.
 */
describe("iptalde sadakat puanı", () => {
  it("VERİLEN puanı geri alır, güncel fiyatı değil", async () => {
    mockPrisma.booking.findUnique.mockResolvedValue(booking());
    await cancelBooking("b1");
    await new Promise((r) => setTimeout(r, 0));

    const call = mockPrisma.$executeRaw.mock.calls.at(-1);
    // Tagged template: ikinci arguman ilk interpolasyon (puan miktari).
    expect(call?.[1]).toBe(80);
    expect(call?.[1]).not.toBe(192);
  });

  it("ESKİ kayıtlarda (alan 0) puan HİÇ düşülmez", async () => {
    /*
      2026-09-01 oncesi rezervasyonlarda verilen miktar geriye donuk BILINEMEZ.
      Yanlis miktar dusmek yerine hic dusmemek tercih edildi -- baskasinin
      puanini almaktansa bir miktari birakmak yeglenir.
    */
    mockPrisma.booking.findUnique.mockResolvedValue(booking({ loyaltyPointsAwarded: 0 }));
    await cancelBooking("b1");
    await new Promise((r) => setTimeout(r, 0));
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
  });

  it("misafirsiz (guest checkout) rezervasyonda puan işlemi yapılmaz", async () => {
    mockPrisma.booking.findUnique.mockResolvedValue(booking({ guestId: null }));
    await cancelBooking("b1");
    await new Promise((r) => setTimeout(r, 0));
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
  });
});
