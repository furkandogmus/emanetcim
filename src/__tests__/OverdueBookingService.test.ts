/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OverdueBookingService, OVERDUE_TIERS } from "../services/OverdueBookingService";

const { mockPrisma, mockRecord } = vi.hoisted(() => ({
  mockRecord: vi.fn().mockResolvedValue(undefined),
  mockPrisma: {
    booking: { count: vi.fn(), findMany: vi.fn() },
    bookingEvent: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/services/BookingEventService", () => ({
  bookingEventService: { record: mockRecord },
}));

const NOW = new Date("2026-08-22T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;

function overdueBy(hours: number, status = "CHECKED_IN", id = "b1") {
  return {
    id,
    shopId: "s1",
    status,
    checkOutTime: new Date(NOW.getTime() - hours * HOUR),
  };
}

describe("OverdueBookingService", () => {
  const service = new OverdueBookingService();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.bookingEvent.findMany.mockResolvedValue([]);
    mockPrisma.booking.count.mockResolvedValue(0);
    mockPrisma.booking.findMany.mockResolvedValue([]);
  });

  it("24 saatin altındaki gecikmeyi bildirmez — normal operasyon toleransı", async () => {
    mockPrisma.booking.count.mockResolvedValue(1);
    mockPrisma.booking.findMany.mockResolvedValue([overdueBy(5)]);

    const r = await service.scan({ now: NOW });

    expect(r.items).toHaveLength(0);
    expect(r.eventsRecorded).toBe(0);
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it.each([
    [25, "day_1"],
    [80, "day_3"],
    [200, "week_1"],
    [1000, "month_1"],
  ])("%s saatlik gecikme %s eşiğine düşer", async (hours, tier) => {
    mockPrisma.booking.count.mockResolvedValue(1);
    mockPrisma.booking.findMany.mockResolvedValue([overdueBy(hours as number)]);

    const r = await service.scan({ now: NOW });

    expect(r.items[0].tier).toBe(tier);
    expect(r.byTier[tier as keyof typeof r.byTier]).toBe(1);
  });

  it("DURUM DEĞİŞTİRMEZ — yalnızca olay yazar", async () => {
    mockPrisma.booking.count.mockResolvedValue(1);
    mockPrisma.booking.findMany.mockResolvedValue([overdueBy(100)]);

    await service.scan({ now: NOW });

    // Prisma mock'unda booking.update/updateMany hiç tanımlı değil; tanımlı olsaydı
    // bile çağrılmamalı. Yazılan tek şey olay kaydıdır.
    expect(mockPrisma.booking).not.toHaveProperty("update");
    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(mockRecord.mock.calls[0][0].event).toBe("OVERDUE");
  });

  it("aynı eşik ikinci kez yazılmaz (idempotent)", async () => {
    mockPrisma.booking.count.mockResolvedValue(1);
    mockPrisma.booking.findMany.mockResolvedValue([overdueBy(100)]);
    mockPrisma.bookingEvent.findMany.mockResolvedValue([
      { bookingId: "b1", metadata: { tier: "day_3" } },
    ]);

    const r = await service.scan({ now: NOW });

    expect(r.eventsRecorded).toBe(0);
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it("bir üst eşiğe geçince yeni olay yazılır", async () => {
    mockPrisma.booking.count.mockResolvedValue(1);
    mockPrisma.booking.findMany.mockResolvedValue([overdueBy(200)]); // week_1
    mockPrisma.bookingEvent.findMany.mockResolvedValue([
      { bookingId: "b1", metadata: { tier: "day_3" } },
    ]);

    const r = await service.scan({ now: NOW });

    expect(r.eventsRecorded).toBe(1);
    expect(mockRecord.mock.calls[0][0].metadata.tier).toBe("week_1");
  });

  it("bavul dükkanda mı ayrımını yapar — CHECKED_IN fiziksel zilyetliktir", async () => {
    mockPrisma.booking.count.mockResolvedValue(2);
    mockPrisma.booking.findMany.mockResolvedValue([
      overdueBy(100, "CHECKED_IN", "b1"),
      overdueBy(100, "PAID", "b2"),
    ]);

    const r = await service.scan({ now: NOW });

    expect(r.bagsInShopCount).toBe(1);
    expect(r.items.find((i) => i.bookingId === "b1")?.bagsInShop).toBe(true);
    expect(r.items.find((i) => i.bookingId === "b2")?.bagsInShop).toBe(false);
  });

  it("sayımlar limitten etkilenmez — sessiz kırpma yok", async () => {
    // 500 kayıt var, rapora 1 tanesi alınıyor. overdueCount yine de gerçek toplam.
    mockPrisma.booking.count.mockResolvedValue(500);
    mockPrisma.booking.findMany.mockResolvedValue([overdueBy(100)]);

    const r = await service.scan({ now: NOW, limit: 1 });

    expect(r.overdueCount).toBe(500);
    expect(r.items).toHaveLength(1);
  });

  it("recordEvents: false iken hiçbir şey yazmaz — sağlık ucu bunu kullanır", async () => {
    mockPrisma.booking.count.mockResolvedValue(1);
    mockPrisma.booking.findMany.mockResolvedValue([overdueBy(100)]);

    const r = await service.scan({ now: NOW, recordEvents: false });

    expect(r.eventsRecorded).toBe(0);
    expect(mockRecord).not.toHaveBeenCalled();
    expect(mockPrisma.bookingEvent.findMany).not.toHaveBeenCalled();
  });

  it("en eski gecikmeyi raporlar — sağlık sinyali sayı değil yaştır", async () => {
    mockPrisma.booking.count.mockResolvedValue(3);
    mockPrisma.booking.findMany.mockResolvedValue([
      overdueBy(1500, "CHECKED_IN", "b1"),
      overdueBy(30, "PAID", "b2"),
    ]);

    const r = await service.scan({ now: NOW });

    expect(r.oldestOverdueHours).toBe(1500);
  });

  it("eşikler artan sırada ve çakışmıyor", () => {
    const hours = OVERDUE_TIERS.map((t) => t.hours);
    expect(hours).toEqual([...hours].sort((a, b) => a - b));
    expect(new Set(hours).size).toBe(hours.length);
  });
});
