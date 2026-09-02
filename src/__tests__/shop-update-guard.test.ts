import { describe, it, expect, vi } from "vitest";

/**
 * DUKKAN GUNCELLEME KAPISI -- TASIYICILARDAN BAGIMSIZ.
 *
 * Gercek veritabaninda olculdu (2026-09-02): `updateShop` hicbir dogrulama
 * yapmiyordu ve servis dogrudan cagrildiginda su degerler KAYDA GIRIYORDU --
 *
 *     capacity: -10        -> kaydedildi
 *     pricePerDay: -100    -> kaydedildi
 *     openingTime: "99:99" -> kaydedildi
 *
 * Her biri dukkani farkli bicimde bozar:
 *
 *   - NEGATIF KAPASITE dukkani OLDURUR: kapasite kontrolu
 *     `used + newBags > shop.capacity` diye bakiyor, yani ilk valiz bile
 *     sigmiyor ve dukkan hicbir rezervasyon alamiyor -- esnaf sebebini goremez.
 *   - NEGATIF FIYAT fiyat hesabinin tabanidir; oradan asagisi misafire para
 *     vermek demek.
 *   - GECERSIZ SAAT acik/kapali kararini belirsizlestirir; check-in tezgahta
 *     reddedilebilir.
 *
 * Tasiyicilar zod ile doguruyor, yani bu degerler bugun disaridan gelemez --
 * ama CLAUDE.md "yazma islemleri yalnizca `src/services/` uzerinden" diyor ve
 * son savunma hatti da orasi olmali. Ayni gun rezervasyon girdi kapisi da
 * ayni gerekceyle eklendi.
 */

const { mockUpdate } = vi.hoisted(() => ({ mockUpdate: vi.fn() }));

vi.mock("@/lib/db", () => ({
  default: {
    // Kapi Prisma'dan ONCE calisiyor; gecersiz girdide bu hic cagrilmamali.
    shop: { update: mockUpdate },
  },
}));
vi.mock("@/services/NotificationService", () => ({ notificationService: {} }));
vi.mock("@/services/SealService", () => ({ sealService: {} }));

const { shopService } = await import("@/services/ShopService");

async function reddiYakala(veri: Record<string, unknown>) {
  mockUpdate.mockClear();
  try {
    await shopService.updateShop("s1", veri as never);
    return null;
  } catch (e) {
    return String((e as Error).message);
  }
}

describe("dukkan guncelleme kapisi", () => {
  it.each([
    ["kapasite 0", { capacity: 0 }, "SHOP_INVALID_CAPACITY"],
    ["kapasite -10", { capacity: -10 }, "SHOP_INVALID_CAPACITY"],
    ["kesirli kapasite", { capacity: 2.5 }, "SHOP_INVALID_CAPACITY"],
    ["negatif gunluk fiyat", { pricePerDay: -100 }, "SHOP_INVALID_PRICE"],
    ["negatif saatlik fiyat", { pricePerHour: -1 }, "SHOP_INVALID_PRICE"],
    ["gecersiz acilis saati", { openingTime: "99:99" }, "SHOP_INVALID_HOURS"],
    ["gecersiz kapanis saati", { closingTime: "9:00" }, "SHOP_INVALID_HOURS"],
    ["saat yerine metin", { openingTime: "sabah" }, "SHOP_INVALID_HOURS"],
  ])("%s reddediliyor", async (_ad, veri, kod) => {
    const hata = await reddiYakala(veri);
    expect(hata, "reddedilmeliydi").toContain(kod);
    expect(mockUpdate, "gecersiz girdi veritabanina GITMEMELI").not.toHaveBeenCalled();
  });

  it.each([
    ["gecerli kapasite", { capacity: 25 }],
    ["sifir fiyat (kampanya)", { pricePerDay: 0 }],
    ["gece yarisi", { openingTime: "00:00" }],
    ["gun sonu", { closingTime: "23:59" }],
    ["ilgisiz alan", { name: "Yeni Ad" }],
  ])("%s KABUL ediliyor", async (_ad, veri) => {
    mockUpdate.mockClear();
    mockUpdate.mockResolvedValue({ id: "s1" });
    await shopService.updateShop("s1", veri as never);
    expect(mockUpdate, "gecerli girdi gecmeli").toHaveBeenCalled();
  });
});
