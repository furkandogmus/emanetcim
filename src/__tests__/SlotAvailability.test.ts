import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * getSlotAvailability'nin "legacy rezervasyon" muhasebesi.
 *
 * Neden kritik: slot üretimi 2026-07-14'te durdu ve rezervasyonlar aylarca dükkan
 * geneli kapasite kontrolüyle oluşturuldu; hiç `ReservationSlot` satırı yazılmadı
 * (prod'da 19 rezervasyona karşı 0 satır). Slot üretimi tekrar açıldığında bu
 * rezervasyonlar per-slot sayımda görünmezse dolu bir dükkan boş görünür ve FAZLA
 * SATIŞ yapılır. Bu test tam olarak o senaryoyu kilitler.
 */

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    shopTimeSlot: { findMany: vi.fn() },
    reservationSlot: { groupBy: vi.fn() },
    booking: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ default: mockPrisma }));

const { getSlotAvailability } = await import("../services/SlotService");

const SHOP = "shop-1";
const from = new Date("2026-09-01T09:00:00Z");
const to = new Date("2026-09-01T11:00:00Z");

/** 09:00-09:30 ve 09:30-10:00, kapasite 10 */
function twoSlots() {
  return [
    {
      id: "slot-a",
      startTime: new Date("2026-09-01T09:00:00Z"),
      endTime: new Date("2026-09-01T09:30:00Z"),
      capacity: 10,
    },
    {
      id: "slot-b",
      startTime: new Date("2026-09-01T09:30:00Z"),
      endTime: new Date("2026-09-01T10:00:00Z"),
      capacity: 10,
    },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.shopTimeSlot.findMany.mockResolvedValue(twoSlots());
  mockPrisma.reservationSlot.groupBy.mockResolvedValue([]);
  mockPrisma.booking.findMany.mockResolvedValue([]);
});

describe("getSlotAvailability", () => {
  it("hiç rezervasyon yoksa tüm kapasite müsait", async () => {
    const out = await getSlotAvailability(SHOP, from, to);
    expect(out.map((s) => s.available)).toEqual([10, 10]);
    expect(out.map((s) => s.reserved)).toEqual([0, 0]);
  });

  it("slot bazlı rezervasyonları düşer", async () => {
    mockPrisma.reservationSlot.groupBy.mockResolvedValue([
      { slotId: "slot-a", _sum: { bagCount: 3 } },
    ]);
    const out = await getSlotAvailability(SHOP, from, to);
    expect(out[0]).toMatchObject({ reserved: 3, available: 7 });
    expect(out[1]).toMatchObject({ reserved: 0, available: 10 });
  });

  it("ReservationSlot satırı OLMAYAN rezervasyonu da yer kaplar sayar", async () => {
    // 09:00-10:00 arasi, 4 valiz, hic slot satiri yok (legacy yoldan olusmus).
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        checkInTime: new Date("2026-09-01T09:00:00Z"),
        checkOutTime: new Date("2026-09-01T10:00:00Z"),
        bagCountS: 1,
        bagCountM: 2,
        bagCountXl: 1,
      },
    ]);
    const out = await getSlotAvailability(SHOP, from, to);
    // Iki slotun IKISI de bu rezervasyonla cakisiyor.
    expect(out[0]).toMatchObject({ reserved: 4, available: 6 });
    expect(out[1]).toMatchObject({ reserved: 4, available: 6 });
  });

  it("legacy rezervasyon yalnızca ÇAKIŞTIĞI slotu etkiler", async () => {
    // 09:35-09:55: sadece ikinci slotla cakisir.
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        checkInTime: new Date("2026-09-01T09:35:00Z"),
        checkOutTime: new Date("2026-09-01T09:55:00Z"),
        bagCountS: 2,
        bagCountM: 0,
        bagCountXl: 0,
      },
    ]);
    const out = await getSlotAvailability(SHOP, from, to);
    expect(out[0]).toMatchObject({ reserved: 0, available: 10 });
    expect(out[1]).toMatchObject({ reserved: 2, available: 8 });
  });

  it("slot bazlı ve legacy rezervasyonlar toplanır", async () => {
    mockPrisma.reservationSlot.groupBy.mockResolvedValue([
      { slotId: "slot-a", _sum: { bagCount: 6 } },
    ]);
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        checkInTime: new Date("2026-09-01T09:00:00Z"),
        checkOutTime: new Date("2026-09-01T09:30:00Z"),
        bagCountS: 3,
        bagCountM: 0,
        bagCountXl: 0,
      },
    ]);
    const out = await getSlotAvailability(SHOP, from, to);
    expect(out[0]).toMatchObject({ reserved: 9, available: 1 });
  });

  it("kapasite aşılırsa müsaitlik negatife düşmez, 0'da kalır", async () => {
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        checkInTime: new Date("2026-09-01T09:00:00Z"),
        checkOutTime: new Date("2026-09-01T10:00:00Z"),
        bagCountS: 50,
        bagCountM: 0,
        bagCountXl: 0,
      },
    ]);
    const out = await getSlotAvailability(SHOP, from, to);
    expect(out.map((s) => s.available)).toEqual([0, 0]);
  });

  it("bitişik rezervasyon çakışma saymaz (sınır dahil değil)", async () => {
    // 08:00-09:00 biter, ilk slot 09:00'da baslar -> cakisma YOK.
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        checkInTime: new Date("2026-09-01T08:00:00Z"),
        checkOutTime: new Date("2026-09-01T09:00:00Z"),
        bagCountS: 5,
        bagCountM: 0,
        bagCountXl: 0,
      },
    ]);
    const out = await getSlotAvailability(SHOP, from, to);
    expect(out.map((s) => s.reserved)).toEqual([0, 0]);
  });

  it("legacy sorgusu yalnızca slot satırı olmayan rezervasyonları ister", async () => {
    await getSlotAvailability(SHOP, from, to);
    const arg = mockPrisma.booking.findMany.mock.calls[0][0];
    expect(arg.where.reservationSlots).toEqual({ none: {} });
    expect(arg.where.shopId).toBe(SHOP);
  });
});
