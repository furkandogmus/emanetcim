import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Destek hatti senaryosu: misafir biletteki kodu (id'nin ilk 8 karakteri, BUYUK harf)
 * okur. id veritabaninda kucuk harf; arama kucuge cevirip onekle eslemeli.
 * Gecikmis filtresi OverdueBookingService ile ayni tanimi kullanmali.
 */

const { findMany, count } = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: { booking: { findMany, count } } }));
vi.mock("@/services/OverdueBookingService", () => ({ overdueBookingService: { scan: vi.fn() } }));

import { AdminOpsService } from "@/services/AdminOpsService";

describe("AdminOpsService.listBookings", () => {
  beforeEach(() => {
    findMany.mockReset().mockResolvedValue([]);
    count.mockReset().mockResolvedValue(0);
  });

  it("bilet kodunda once yalnizca kucuk harfli id onekiyle arar, bulursa durur", async () => {
    findMany.mockResolvedValueOnce([{ id: "158d1519-x" }]);
    const rows = await new AdminOpsService().listBookings({ filter: "all", q: "158D1519" });
    expect(rows).toEqual([{ id: "158d1519-x" }]);
    expect(findMany).toHaveBeenCalledTimes(1);
    const where = JSON.stringify(findMany.mock.calls[0][0].where);
    expect(where).toContain('"startsWith":"158d1519"');
    expect(where).not.toContain("insensitive");
  });

  it("kod bulunamazsa ad/e-posta/dukkan aramasina duser", async () => {
    await new AdminOpsService().listBookings({ filter: "all", q: "abcd" });
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(findMany.mock.calls[1][0].where)).toContain("insensitive");
  });

  it("kod gibi gorunmeyen aramada id kosulu eklemez, kisa aramayi yok sayar", async () => {
    const svc = new AdminOpsService();
    await svc.listBookings({ filter: "all", q: "Elif" });
    expect(JSON.stringify(findMany.mock.calls[0][0].where)).not.toContain("startsWith");
    await svc.listBookings({ filter: "all", q: "E" });
    expect(findMany.mock.calls[1][0].where).toEqual({});
  });

  it("gecikmis: cikis saati gecmis ve hala acik, en eski once", async () => {
    const now = new Date("2026-11-17T09:00:00.000Z");
    await new AdminOpsService().listBookings({ filter: "overdue", now });
    const call = findMany.mock.calls[0][0];
    expect(call.where.checkOutTime).toEqual({ lt: now });
    expect(call.where.status.in).toEqual(expect.arrayContaining(["CHECKED_IN", "APPROVED", "PAID"]));
    expect(call.orderBy).toEqual({ checkOutTime: "asc" });
  });
});
