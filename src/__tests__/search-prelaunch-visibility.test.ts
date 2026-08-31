import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * TALEP TESTİ NOKTALARI ARAMADA GÖRÜNMEK ZORUNDA.
 *
 * NEDEN BU DOSYA VAR (2026-08-31, üretimde ölçüldü): 482 nokta üretime yazıldı
 * ve arama ekranı İstanbul'da "TÜM NOKTALAR (3)" dedi — 10 İstanbul noktasının
 * hiçbiri listede yoktu. Sebep, özelliğin kendi tasarımıydı: prelaunch noktaları
 * bilerek slot ÜRETMİYOR (`OPERATING_SHOP_FILTER` onları slot üretiminin dışında
 * tutuyor), `findShopsForSearch` ise slot dalında `slots.length === 0` gördüğü
 * her dükkanı eliyordu. Yani talep testinin TAMAMI görünmezdi ve ölçmek
 * istediğimiz tek şey — misafirin o noktaya tıklaması — hiç gerçekleşemezdi.
 *
 * Sessizce geri gelebilecek bir hata: arama tarafında yazılan herhangi bir yeni
 * süzgeç (müsaitlik, çalışma saati, kapasite, fiyat) prelaunch'u yeniden eler ve
 * hiçbir test kırılmaz — nokta "yok" olduğunda hata mesajı da yoktur. Bu yüzden
 * kural burada ölçülüyor.
 */

const { mockPrisma, mockGetActiveShops, mockGetSlotAvailabilityForShops } = vi.hoisted(() => ({
  mockPrisma: { booking: { groupBy: vi.fn() } },
  mockGetActiveShops: vi.fn(),
  /*
    `getSlotAvailabilityForShops` TOPLU surum: dukkan basina ayri cagri yerine
    tek cagri, `Map<shopId, slots[]>` donuyor. Arama bunu 2026-08-31'de
    kullanmaya basladi -- yuz dukkan icin sirayla uc yuze varan sorgu
    kosuyordu.
  */
  mockGetSlotAvailabilityForShops: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/shop-distance-postgis", () => ({
  getActiveShopsOrderedByDistanceKm: mockGetActiveShops,
}));
vi.mock("@/services/SlotService", () => ({
  getSlotAvailabilityForShops: mockGetSlotAvailabilityForShops,
}));
vi.mock("@/services/NotificationService", () => ({ notificationService: {} }));

import { shopService } from "@/services/ShopService";

/** 09:00–20:00 arası, aynı gün: çalışma saati kontrolünü geçen bir pencere. */
const CHECK_IN = new Date("2026-09-01T10:00:00+03:00");
const CHECK_OUT = new Date("2026-09-01T18:00:00+03:00");

function shop(overrides: Record<string, unknown>) {
  return {
    id: "s",
    ownerId: "o",
    name: "Dukkan",
    address: null,
    image: null,
    description: null,
    latitude: 41.0,
    longitude: 29.0,
    capacity: 10,
    isActive: true,
    rating: 0,
    pricePerDay: 50,
    pricePerHour: 10,
    hasRestroom: false,
    hasCctv: false,
    hasClimateControl: false,
    acceptsLargeItems: false,
    open247: false,
    openingTime: "09:00",
    closingTime: "20:00",
    createdAt: new Date(),
    updatedAt: new Date(),
    city: "Istanbul",
    district: null,
    sealLeadTimeDays: 3,
    sealReorderPoint: 15,
    isVerified: false,
    responseTimeMinutes: 0,
    timezone: "Europe/Istanbul",
    isTest: false,
    isPrelaunch: false,
    ...overrides,
  };
}

const SEARCH = {
  centerLat: 41.0,
  centerLng: 29.0,
  radiusKm: null,
  checkIn: CHECK_IN,
  checkOut: CHECK_OUT,
  requestedBags: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.booking.groupBy.mockResolvedValue([]);
});

describe("findShopsForSearch — talep testi noktaları", () => {
  it("slotu olmayan prelaunch noktası yine de listelenir", async () => {
    mockGetActiveShops.mockResolvedValue([
      { shop: shop({ id: "pre-1", isPrelaunch: true }), distanceKm: 1 },
      { shop: shop({ id: "acik-1" }), distanceKm: 2 },
    ]);
    // Prelaunch noktasının slotu YOK; gerçek dükkanınki var.
    // Toplu surum `Map<shopId, slots[]>` donuyor; prelaunch noktasi haritada YOK.
    mockGetSlotAvailabilityForShops.mockResolvedValue(
      new Map([["acik-1", [{ available: 5 }]]]),
    );

    const hits = await shopService.findShopsForSearch(SEARCH);

    expect(hits.map((h) => h.id)).toContain("pre-1");
    expect(hits).toHaveLength(2);
  });

  it("rezervasyon alabilen dükkan, daha yakın olsa bile prelaunch'tan önce gelir", async () => {
    mockGetActiveShops.mockResolvedValue([
      // Prelaunch DAHA YAKIN: mesafe puanı tek başına karar verseydi öne geçerdi.
      { shop: shop({ id: "pre-1", isPrelaunch: true }), distanceKm: 0.1 },
      { shop: shop({ id: "acik-1" }), distanceKm: 9 },
    ]);
    // Toplu surum `Map<shopId, slots[]>` donuyor; prelaunch noktasi haritada YOK.
    mockGetSlotAvailabilityForShops.mockResolvedValue(
      new Map([["acik-1", [{ available: 5 }]]]),
    );

    const hits = await shopService.findShopsForSearch(SEARCH);

    expect(hits.map((h) => h.id)).toEqual(["acik-1", "pre-1"]);
  });

  it("prelaunch noktası, gerçek dükkanların kapasite yedeğine düşmesini engellemez", async () => {
    /**
     * Slot tablosu boşsa (ör. üretim henüz slot üretmemişken) eski kapasite
     * dalına düşülür. Prelaunch noktası `hits`i doldursaydı bu düşüş hiç
     * olmazdı ve gerçek dükkan aramadan kaybolurdu — düzeltmenin kendi
     * yarattığı regresyon tam olarak budur.
     */
    mockGetActiveShops.mockResolvedValue([
      { shop: shop({ id: "pre-1", isPrelaunch: true }), distanceKm: 1 },
      { shop: shop({ id: "acik-1" }), distanceKm: 2 },
    ]);
    mockGetSlotAvailabilityForShops.mockResolvedValue(new Map());

    const hits = await shopService.findShopsForSearch(SEARCH);

    expect(hits.map((h) => h.id).sort()).toEqual(["acik-1", "pre-1"]);
    expect(hits.find((h) => h.id === "acik-1")?.bagsAvailable).toBe(10);
  });

  it("yalnızca prelaunch varsa sonuç boş dönmez", async () => {
    mockGetActiveShops.mockResolvedValue([
      { shop: shop({ id: "pre-1", isPrelaunch: true }), distanceKm: 1 },
      { shop: shop({ id: "pre-2", isPrelaunch: true }), distanceKm: 3 },
    ]);
    mockGetSlotAvailabilityForShops.mockResolvedValue(new Map());

    const hits = await shopService.findShopsForSearch(SEARCH);

    expect(hits.map((h) => h.id)).toEqual(["pre-1", "pre-2"]);
    // Kapasite sorgusu hiç çalışmamalı: sorulacak bir işletilen dükkan yok.
    expect(mockPrisma.booking.groupBy).not.toHaveBeenCalled();
  });

  it("prelaunch noktası isPrelaunch bayrağını arayüze taşır", async () => {
    mockGetActiveShops.mockResolvedValue([
      { shop: shop({ id: "pre-1", isPrelaunch: true }), distanceKm: 1 },
    ]);
    mockGetSlotAvailabilityForShops.mockResolvedValue(new Map());

    const hits = await shopService.findShopsForSearch(SEARCH);

    // Kart ve harita fiyat yerine "Yakında" çizebilmek için buna bakıyor.
    expect(hits[0].isPrelaunch).toBe(true);
  });
});
