import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * ARAMA, DUKKAN BASINA SORGU KOSMAZ.
 *
 * NEDEN VAR (2026-08-31'de olculdu): `findShopsForSearch` sunu yapiyordu:
 *
 *     for (const shop of operating) {
 *       const slots = await getSlotAvailability(shop.id, checkIn, checkOut);
 *     }
 *
 * `operating` YUZ dukkana kadar cikabiliyor
 * (`getActiveShopsOrderedByDistanceKm` `take: 100` ile cagriliyor) ve
 * `getSlotAvailability` dukkan basina UC sorgu kosuyor: slot listesi,
 * `ReservationSlot` toplami, ve kendi slot satiri olmayan eski rezervasyonlar.
 *
 * Yani TEK BIR ARAMA ISTEGI, SIRAYLA, uc yuze varan veritabani gidis-donusu
 * uretiyordu -- sitenin en cok trafik alan sayfasinda ve kimlik dogrulamasi
 * olmadan.
 *
 * Paralellestirmek yetmezdi: yuz es zamanli sorgu bu sefer baglanti havuzunu
 * (`PG_POOL_MAX`, varsayilan 10) doldurur ve diger istekleri bekletirdi. Dogru
 * cozum sorgu SAYISINI dusurmek, es zamanliligi artirmak degil.
 *
 * Bu test sayiyi degil, SEKLI olcuyor: cagri sayisi dukkan sayisiyla
 * BUYUMEMELI. Uc dukkanla yuz dukkan ayni sayida cagri uretmeli.
 */

const { mockGetActiveShops, mockGetSlotAvailabilityForShops, mockPrisma } = vi.hoisted(
  () => ({
    mockGetActiveShops: vi.fn(),
    mockGetSlotAvailabilityForShops: vi.fn(),
    mockPrisma: { booking: { groupBy: vi.fn() } },
  }),
);

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/shop-distance-postgis", () => ({
  getActiveShopsOrderedByDistanceKm: mockGetActiveShops,
}));
vi.mock("@/services/SlotService", () => ({
  getSlotAvailabilityForShops: mockGetSlotAvailabilityForShops,
}));
vi.mock("@/services/NotificationService", () => ({ notificationService: {} }));

import { shopService } from "@/services/ShopService";

const CHECK_IN = new Date("2026-09-01T10:00:00+03:00");
const CHECK_OUT = new Date("2026-09-01T18:00:00+03:00");

const SEARCH = {
  centerLat: 41,
  centerLng: 29,
  radiusKm: 10,
  checkIn: CHECK_IN,
  checkOut: CHECK_OUT,
  requestedBags: 1,
};

function shop(id: string) {
  return {
    id,
    ownerId: "o",
    name: `Dukkan ${id}`,
    address: "Adres",
    city: "Istanbul",
    district: "Kadikoy",
    latitude: 41,
    longitude: 29,
    capacity: 50,
    pricePerDay: 100,
    isActive: true,
    isTest: false,
    isPrelaunch: false,
    isVerified: true,
    open247: true,
    openingTime: "09:00",
    closingTime: "20:00",
    timezone: "Europe/Istanbul",
    rating: 4,
    image: null,
    sealLeadTimeDays: 2,
    sealReorderPoint: 15,
    responseTimeMinutes: null,
  };
}

function withShops(n: number) {
  mockGetActiveShops.mockResolvedValue(
    Array.from({ length: n }, (_, i) => ({
      shop: shop(`s${i}`),
      distanceKm: 1 + i * 0.1,
    })),
  );
  mockGetSlotAvailabilityForShops.mockResolvedValue(
    new Map(
      Array.from({ length: n }, (_, i) => [`s${i}`, [{ available: 10 }]]),
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.booking.groupBy.mockResolvedValue([]);
});

describe("arama sorgu sayisi dukkan sayisiyla buyumuyor", () => {
  it("uc dukkan icin musaitlik TEK cagri", async () => {
    withShops(3);
    const hits = await shopService.findShopsForSearch(SEARCH);
    expect(hits).toHaveLength(3);
    expect(mockGetSlotAvailabilityForShops).toHaveBeenCalledTimes(1);
  });

  it("yuz dukkan icin de TEK cagri", async () => {
    /*
      Asil olcum bu: eski dongude bu satir 100 cagri (ve ~300 sorgu)
      uretiyordu. Sayinin dukkan sayisindan BAGIMSIZ olmasi gerekiyor.
    */
    withShops(100);
    const hits = await shopService.findShopsForSearch(SEARCH);
    expect(hits).toHaveLength(100);
    expect(mockGetSlotAvailabilityForShops).toHaveBeenCalledTimes(1);
  });

  it("toplu cagri butun dukkan kimliklerini TEK seferde geciyor", async () => {
    withShops(12);
    await shopService.findShopsForSearch(SEARCH);
    const [shopIds] = mockGetSlotAvailabilityForShops.mock.calls[0];
    expect(shopIds).toHaveLength(12);
  });

  it("toplu cagri patlarsa arama olmez, ESKI KAPASITE dalina duser", async () => {
    /*
      Onceki dongude her cagri kendi `try`indeydi ve hata yutuluyordu; sonucta
      hic `hit` cikmazsa eski kapasite dali calisiyordu. Toplu cagriyi ciplak
      birakmak bu davranisi degistirirdi: tek bir hata butun aramayi dusururdu.
    */
    withShops(3);
    mockGetSlotAvailabilityForShops.mockRejectedValue(new Error("db down"));

    const hits = await shopService.findShopsForSearch(SEARCH);

    expect(hits, "eski dal kapasiteden hesaplayip yine sonuc dondurmeli").toHaveLength(3);
    expect(mockPrisma.booking.groupBy).toHaveBeenCalled();
  });
});
