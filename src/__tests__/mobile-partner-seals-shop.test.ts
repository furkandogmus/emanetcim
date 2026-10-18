import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Mühür uclari dukkani web ile ayni kuralla secer (`resolvePartnerShops`,
 * `?shop=`). Eskiden sirasiz `findFirst` idi: cok dukkanli esnafta stok rastgele
 * dukkandan okunup talep oraya aciliyordu.
 */
const { mockRequireMobileUser, mockResolve, mockDb, mockSealService } = vi.hoisted(() => ({
  mockRequireMobileUser: vi.fn(),
  mockResolve: vi.fn(),
  mockDb: {
    shop: { findUnique: vi.fn(), findFirst: vi.fn() },
    seal: { count: vi.fn() },
    sealRequest: { findMany: vi.fn() },
  },
  mockSealService: { createRequest: vi.fn(), markSealAsFaulty: vi.fn() },
}));
vi.mock("@/lib/mobile-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-auth")>()),
  requireMobileUser: mockRequireMobileUser,
}));
vi.mock("@/lib/partner-shop", () => ({ resolvePartnerShops: mockResolve }));
vi.mock("@/lib/db", () => ({ default: mockDb }));
vi.mock("@/services/SealService", () => ({ sealService: mockSealService }));

import { GET } from "@/app/api/mobile/partner/seals/route";
import { POST as requestSeals } from "@/app/api/mobile/partner/seals/request/route";
import { POST as reportFaulty } from "@/app/api/mobile/partner/seals/report-faulty/route";

const URL_BASE = "https://bagajpark.com/api/mobile/partner/seals";

function post(path: string, body: unknown) {
  return new NextRequest(`${URL_BASE}${path}`, { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileUser.mockResolvedValue({ user: { id: "p1", role: "PARTNER" } });
  mockResolve.mockResolvedValue({
    shops: [{ id: "s2", name: "Galata" }, { id: "s1", name: "Kadıköy" }],
    activeShop: { id: "s2", name: "Galata" },
  });
  mockDb.shop.findUnique.mockResolvedValue({ id: "s2", name: "Galata", sealReorderPoint: 10 });
  mockDb.seal.count.mockResolvedValue(0);
  mockDb.sealRequest.findMany.mockResolvedValue([]);
  mockSealService.createRequest.mockResolvedValue({ ok: true, requestId: "r1" });
  mockSealService.markSealAsFaulty.mockResolvedValue(undefined);
});

describe("mobil mühür uçlarında dükkan seçimi", () => {
  it("stok web ile aynı seçimden okunur ve yanıt dükkanı söyler", async () => {
    const res = (await GET(new NextRequest(`${URL_BASE}?shop=s2`)))!;
    expect(res.status).toBe(200);
    expect(mockResolve).toHaveBeenCalledWith("p1", "s2");
    expect(mockDb.shop.findFirst).not.toHaveBeenCalled();
    expect((await res.json()).shop).toEqual({ id: "s2", name: "Galata" });
  });

  it("talep seçilen dükkana açılır", async () => {
    const res = (await requestSeals(post("/request?shop=s2", { count: 5 })))!;
    expect(res.status).toBe(200);
    expect(mockResolve).toHaveBeenCalledWith("p1", "s2");
    expect(mockSealService.createRequest).toHaveBeenCalledWith("s2", 5, { id: "p1", role: "PARTNER" });
  });

  it("arızalı bildirimi seçilen dükkanın sahipliğiyle doğrulanır", async () => {
    const res = (await reportFaulty(post("/report-faulty?shop=s2", { serialNumber: 100102 })))!;
    expect(res.status).toBe(200);
    expect(mockSealService.markSealAsFaulty).toHaveBeenCalledWith(100102, "s2", { id: "p1", role: "PARTNER" });
  });

  it("dükkan belirtilmezse seçime null gider (web varsayılanı)", async () => {
    await GET(new NextRequest(URL_BASE));
    expect(mockResolve).toHaveBeenCalledWith("p1", null);
  });

  it("dükkansız esnafa üç uç da 404 no_shop", async () => {
    mockResolve.mockResolvedValue({ shops: [], activeShop: null });
    for (const res of [
      (await GET(new NextRequest(URL_BASE)))!,
      (await requestSeals(post("/request", { count: 5 })))!,
      (await reportFaulty(post("/report-faulty", { serialNumber: 1 })))!,
    ]) {
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "no_shop" });
    }
    expect(mockSealService.createRequest).not.toHaveBeenCalled();
  });
});
