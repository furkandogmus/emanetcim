import { describe, it, expect, vi, beforeEach } from "vitest";
import { ShopService } from "../services/ShopService";
import { RESPONSE_TIME_MIN_SAMPLES } from "@/lib/shop-response-time";

/**
 * `recomputeResponseTimes` bir GECELIK IS ve dukkan sayisiyla olcekleniyor.
 *
 * Eskiden dukkan basina bir `UPDATE` atiyordu — sirayla. Dukkanlarin ezici
 * cogunlugunun yeterli ornegi hic olmuyor; onlar icin hesap her gece `null`
 * cikiyor ve ZATEN `null` olan satir tekrar yaziliyordu. Yani yazmalarin
 * neredeyse tamami hicbir seyi degistirmiyor, ama havuzdan bir baglantiyi
 * dukkan sayisiyla orantili sure boyunca tutuyordu.
 *
 * Bu testin korudugu sey o: DEGISMEYEN SATIR YAZILMAZ.
 */

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    bookingEvent: { findMany: vi.fn() },
    booking: { findMany: vi.fn() },
    shop: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ default: mockPrisma }));

const NOW = new Date("2026-08-26T12:00:00.000Z");
const MIN = 60 * 1000;

/** Ayni dukkan icin, her biri `minutes` dakika suren `n` onay ornegi uretir. */
function approvals(shopId: string, n: number, minutes: number) {
  const events = [];
  const bookings = [];
  for (let i = 0; i < n; i++) {
    const id = `${shopId}-b${i}`;
    const createdAt = new Date(NOW.getTime() - 10 * 24 * 60 * MIN);
    events.push({ bookingId: id, createdAt: new Date(createdAt.getTime() + minutes * MIN) });
    bookings.push({ id, shopId, createdAt });
  }
  return { events, bookings };
}

describe("ShopService.recomputeResponseTimes", () => {
  const service = new ShopService();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.shop.update.mockResolvedValue({});
    mockPrisma.shop.updateMany.mockResolvedValue({ count: 0 });
  });

  it("zaten `null` olan dukkanlari TEKRAR yazmaz", async () => {
    mockPrisma.bookingEvent.findMany.mockResolvedValue([]);
    mockPrisma.booking.findMany.mockResolvedValue([]);
    mockPrisma.shop.findMany.mockResolvedValue([
      { id: "s1", responseTimeMinutes: null },
      { id: "s2", responseTimeMinutes: null },
      { id: "s3", responseTimeMinutes: null },
    ]);

    const result = await service.recomputeResponseTimes(NOW);

    expect(mockPrisma.shop.update).not.toHaveBeenCalled();
    expect(mockPrisma.shop.updateMany).not.toHaveBeenCalled();
    expect(result.written).toBe(0);
    // `cleared` SONUCU anlatir (uc dukkanin da degeri yok), yazmayi degil.
    expect(result.cleared).toBe(3);
  });

  it("degeri degismeyen dukkani TEKRAR yazmaz", async () => {
    const { events, bookings } = approvals("s1", RESPONSE_TIME_MIN_SAMPLES, 7);
    mockPrisma.bookingEvent.findMany.mockResolvedValue(events);
    mockPrisma.booking.findMany.mockResolvedValue(bookings);
    // Depodaki deger, birazdan hesaplanacak olanla AYNI.
    mockPrisma.shop.findMany.mockResolvedValue([{ id: "s1", responseTimeMinutes: 7 }]);

    const result = await service.recomputeResponseTimes(NOW);

    expect(mockPrisma.shop.update).not.toHaveBeenCalled();
    expect(result.written).toBe(0);
    expect(result.updated).toBe(1);
  });

  it("degeri DEGISEN dukkani yazar", async () => {
    const { events, bookings } = approvals("s1", RESPONSE_TIME_MIN_SAMPLES, 7);
    mockPrisma.bookingEvent.findMany.mockResolvedValue(events);
    mockPrisma.booking.findMany.mockResolvedValue(bookings);
    mockPrisma.shop.findMany.mockResolvedValue([{ id: "s1", responseTimeMinutes: 42 }]);

    const result = await service.recomputeResponseTimes(NOW);

    expect(mockPrisma.shop.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { responseTimeMinutes: 7 },
    });
    expect(result.written).toBe(1);
  });

  it("rozetini kaybedenleri TEK toplu yazmada temizler (dukkan basina bir UPDATE degil)", async () => {
    mockPrisma.bookingEvent.findMany.mockResolvedValue([]);
    mockPrisma.booking.findMany.mockResolvedValue([]);
    // Semada `@default(0)` — hic calismamis bir veritabani boyle gorunur.
    mockPrisma.shop.findMany.mockResolvedValue([
      { id: "s1", responseTimeMinutes: 0 },
      { id: "s2", responseTimeMinutes: 12 },
      { id: "s3", responseTimeMinutes: 0 },
    ]);

    const result = await service.recomputeResponseTimes(NOW);

    expect(mockPrisma.shop.update).not.toHaveBeenCalled();
    expect(mockPrisma.shop.updateMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.shop.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["s1", "s2", "s3"] } },
      data: { responseTimeMinutes: null },
    });
    expect(result.written).toBe(3);
  });

  it("yetersiz ornekli dukkana deger UYDURMAZ", async () => {
    const { events, bookings } = approvals("s1", RESPONSE_TIME_MIN_SAMPLES - 1, 7);
    mockPrisma.bookingEvent.findMany.mockResolvedValue(events);
    mockPrisma.booking.findMany.mockResolvedValue(bookings);
    mockPrisma.shop.findMany.mockResolvedValue([{ id: "s1", responseTimeMinutes: 9 }]);

    const result = await service.recomputeResponseTimes(NOW);

    expect(mockPrisma.shop.update).not.toHaveBeenCalled();
    expect(mockPrisma.shop.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["s1"] } },
      data: { responseTimeMinutes: null },
    });
    expect(result.updated).toBe(0);
    expect(result.cleared).toBe(1);
  });
});
