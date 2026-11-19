import { describe, it, expect, vi } from "vitest";

const { findMany, groupBy } = vi.hoisted(() => ({ findMany: vi.fn(), groupBy: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: { shop: { findMany }, booking: { groupBy } } }));

import { adminOpsService } from "@/services/AdminOpsService";

/**
 * Prod 2026-11-19: 504 aktif kaydin 490'i talep testi noktasiydi ve tek sorgu
 * siralamasiz `take: 300` ile kesiliyordu; mobil admin'de gercek esnaflar eksik.
 */
describe("AdminOpsService.shopsOccupancy", () => {
  it("gercek dukkanlari tavansiz, talep testi noktalarini ayri sorguda getirir", async () => {
    const shop = (id: string, isPrelaunch: boolean) => ({
      id, name: id, district: null, city: null, capacity: 10, rating: 0, isPrelaunch, owner: { phone: null },
    });
    findMany.mockImplementation(async ({ where }: { where: { isPrelaunch: boolean } }) =>
      where.isPrelaunch ? [shop("p1", true)] : [shop("r1", false), shop("r2", false)],
    );
    groupBy.mockResolvedValue([]);

    const out = await adminOpsService.shopsOccupancy();

    expect(out.map((s) => s.id).sort()).toEqual(["p1", "r1", "r2"]);
    const realCall = findMany.mock.calls.find(([a]) => a.where.isPrelaunch === false)![0];
    expect(realCall.take).toBeUndefined();
  });
});
