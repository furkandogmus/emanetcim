import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Gunluk seri web yonetim ana sayfasi ile mobil yonetim ekraninin ORTAK kaynagi.
 * Sunucu UTC calisir; kova Istanbul gunune gore kurulmazsa Istanbul'un 00:00-03:00
 * arasindaki rezervasyonlar bir onceki gune duser (web sayfasinda once boyle idi).
 */

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: { booking: { findMany } } }));
vi.mock("@/services/OverdueBookingService", () => ({ overdueBookingService: { scan: vi.fn() } }));

import { AdminOverviewService } from "@/services/AdminOverviewService";

describe("AdminOverviewService.dailySeries", () => {
  beforeEach(() => findMany.mockReset());

  it("Istanbul gece yarisini gecen rezervasyonu dogru gune koyar, bos gunleri sifirla doldurur", async () => {
    // 17 Kasim 12:00 Istanbul = 09:00 UTC
    const now = new Date("2026-11-17T09:00:00.000Z");
    findMany.mockResolvedValue([
      // 17 Kasim 00:30 Istanbul = 16 Kasim 21:30 UTC -> 17'ye sayilmali
      { createdAt: new Date("2026-11-16T21:30:00.000Z"), totalPrice: 70 },
      { createdAt: new Date("2026-11-17T08:00:00.000Z"), totalPrice: "80.5" },
      // 15 Kasim 23:00 Istanbul
      { createdAt: new Date("2026-11-15T20:00:00.000Z"), totalPrice: 100 },
    ]);

    const series = await new AdminOverviewService().dailySeries(3, now);

    expect(series).toEqual([
      { date: "2026-11-15", revenue: 100, bookings: 1 },
      { date: "2026-11-16", revenue: 0, bookings: 0 },
      { date: "2026-11-17", revenue: 150.5, bookings: 2 },
    ]);
    // Pencere Istanbul'da 15 Kasim 00:00'dan (14 Kasim 21:00 UTC) baslar.
    const where = findMany.mock.calls[0][0].where;
    expect(where.createdAt.gte.toISOString()).toBe("2026-11-14T21:00:00.000Z");
    expect(where.createdAt.lt.toISOString()).toBe("2026-11-17T21:00:00.000Z");
  });
});
