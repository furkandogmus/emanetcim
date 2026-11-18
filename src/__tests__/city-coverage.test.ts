import { describe, it, expect, vi, beforeEach } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: { shop: { findMany } } }));

import { CityCoverageService } from "@/services/CityCoverageService";

describe("CityCoverageService", () => {
  beforeEach(() => findMany.mockReset());

  it("sehirleri yazimdan bagimsiz gruplar, en cok dukkani olani once verir", async () => {
    findMany.mockResolvedValue([
      { city: "Ankara", latitude: 40, longitude: 33, image: null },
      { city: "İstanbul", latitude: 41, longitude: 29, image: null },
      { city: " istanbul ", latitude: 41.2, longitude: 29.2, image: "/a.jpg" },
      { city: "İstanbul", latitude: 41.1, longitude: 29.1, image: "/b.jpg" },
    ]);
    const list = await new CityCoverageService().list();
    expect(list.map((c) => [c.name, c.shopCount])).toEqual([
      ["İstanbul", 3],
      ["Ankara", 1],
    ]);
    expect(list[0].latitude).toBeCloseTo(41.1);
    expect(list[0].coverImage).toBe("/a.jpg");
  });

  it("yalnizca isletilen dukkanlari sorar ve 10 dk onbellekte tutar", async () => {
    findMany.mockResolvedValue([]);
    const svc = new CityCoverageService();
    await svc.list(0);
    await svc.list(5 * 60 * 1000);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0].where).toMatchObject({ isActive: true, isTest: false, isPrelaunch: false });
    await svc.list(11 * 60 * 1000);
    expect(findMany).toHaveBeenCalledTimes(2);
  });
});
