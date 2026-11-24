import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/** Mobil esnaf ayarlarindaki konum pini: web formuyla ayni alanlar, ayni servis. */
const { mockRequireMobileUser, mockShopService } = vi.hoisted(() => ({
  mockRequireMobileUser: vi.fn(),
  mockShopService: { getShopByOwner: vi.fn(), updateSettings: vi.fn() },
}));
vi.mock("@/lib/mobile-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-auth")>()),
  requireMobileUser: mockRequireMobileUser,
}));
vi.mock("@/services/ShopService", () => ({ shopService: mockShopService, priceBand: vi.fn() }));
vi.mock("@/services/ShopGalleryService", () => ({ shopGalleryService: { list: vi.fn() } }));
vi.mock("@/lib/db", () => ({ default: {} }));
vi.mock("@/lib/platform-settings", () => ({ getPricingRules: vi.fn() }));

import { PUT } from "@/app/api/mobile/partner/shop/route";

const SHOP = {
  id: "s1",
  name: "A",
  image: null,
  capacity: 10,
  pricePerDay: 250,
  address: null,
  city: null,
  district: null,
  openingTime: "09:00",
  closingTime: "20:00",
  open247: false,
  latitude: 41.01,
  longitude: 28.97,
};

function put(body: unknown) {
  return PUT(
    new NextRequest("https://example.test/api/mobile/partner/shop", {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileUser.mockResolvedValue({ user: { id: "p1", role: "PARTNER" } });
  mockShopService.getShopByOwner.mockResolvedValue(SHOP);
  mockShopService.updateSettings.mockResolvedValue({
    ok: true,
    shop: SHOP,
    impact: { bookingsOutsideHours: 0, bagsOverCapacity: 0 },
  });
});

describe("PUT partner/shop konum pini", () => {
  it("enlem + boylam servise gider, yanit pini tasir", async () => {
    const res = (await put({ latitude: 41.01, longitude: 28.97 }))!;
    expect(res.status).toBe(200);
    expect(mockShopService.updateSettings).toHaveBeenCalledWith("s1", { latitude: 41.01, longitude: 28.97 });
    expect(await res.json()).toMatchObject({ latitude: 41.01, longitude: 28.97 });
  });

  it("null ikisini birden siler", async () => {
    await put({ latitude: null, longitude: null });
    expect(mockShopService.updateSettings).toHaveBeenCalledWith("s1", { latitude: null, longitude: null });
  });

  it.each([
    [{ latitude: 41 }, "tek alan"],
    [{ latitude: 41, longitude: null }, "yarim silme"],
    [{ latitude: 91, longitude: 28 }, "aralik disi enlem"],
    [{ latitude: 41, longitude: 3e16 }, "dusmus ondalik"],
    [{ latitude: 0, longitude: 0 }, "secilmemis 0,0"],
    [{ latitude: "41", longitude: "28" }, "metin"],
  ])("%j reddedilir (%s)", async (body, _label) => {
    const res = (await put(body))!;
    expect(res.status).toBe(400);
    expect(mockShopService.updateSettings).not.toHaveBeenCalled();
  });

  it("yayindaki dukkanin pini silinemez: servis kodu istemciye gider", async () => {
    mockShopService.updateSettings.mockResolvedValue({ ok: false, reason: "coordinates_required" });
    const res = (await put({ latitude: null, longitude: null }))!;
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "coordinates_required" });
  });

  it("pin gonderilmezse servise konum alani gitmez", async () => {
    await put({ name: "Yeni Ad" });
    expect(mockShopService.updateSettings).toHaveBeenCalledWith("s1", { name: "Yeni Ad" });
  });
});
