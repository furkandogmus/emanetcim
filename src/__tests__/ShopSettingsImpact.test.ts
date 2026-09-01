import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    shop: { findUnique: vi.fn() },
    booking: { findMany: vi.fn(), aggregate: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));

import { shopSettingsImpactService } from "@/services/ShopSettingsImpact";

/** 2026-09-01 10:00 Istanbul = 07:00 UTC */
const at = (hhmm: string) => new Date(`2026-09-01T${hhmm}:00+03:00`);

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.shop.findUnique.mockResolvedValue({
    openingTime: "09:00", closingTime: "22:00", open247: false, timezone: "Europe/Istanbul",
  });
  mockPrisma.booking.findMany.mockResolvedValue([]);
  mockPrisma.booking.aggregate.mockResolvedValue({
    _sum: { bagCountS: 0, bagCountM: 0, bagCountXl: 0 },
  });
});

/**
 * Ayar değişikliğinin MEVCUT rezervasyonlara etkisi. Önceden hiç sorulmuyordu:
 * esnaf saatini daraltıyor, sonucu tezgâhta — misafir valiziyle karşısındayken
 * — öğreniyordu.
 */
describe("ayar değişikliği etkisi", () => {
  it("saat DARALTINCA dışarıda kalan rezervasyonları sayar", async () => {
    mockPrisma.booking.findMany.mockResolvedValue([
      { checkInTime: at("10:00") }, // yeni saatlerin ICINDE
      { checkInTime: at("20:00") }, // 18:00'e daraltilinca DISARIDA
      { checkInTime: at("21:30") }, // DISARIDA
    ]);
    const r = await shopSettingsImpactService.assess({
      shopId: "s1", openingTime: "09:00", closingTime: "18:00", now: at("08:00"),
    });
    expect(r.bookingsOutsideHours).toBe(2);
  });

  it("saat DEĞİŞMEDİYSE sorgu bile çalışmaz", async () => {
    // Fiyat ya da adres degistiren bir kayitta bosuna sorgu atmanin anlami yok.
    await shopSettingsImpactService.assess({ shopId: "s1", capacity: 100 });
    expect(mockPrisma.booking.findMany).not.toHaveBeenCalled();
  });

  it("7/24 dükkanda saat etkisi ARANMAZ", async () => {
    mockPrisma.shop.findUnique.mockResolvedValue({
      openingTime: "09:00", closingTime: "22:00", open247: true, timezone: "Europe/Istanbul",
    });
    const r = await shopSettingsImpactService.assess({
      shopId: "s1", openingTime: "10:00", closingTime: "11:00",
    });
    expect(r.bookingsOutsideHours).toBe(0);
    expect(mockPrisma.booking.findMany).not.toHaveBeenCalled();
  });

  it("kapasite DÜŞÜRÜLÜNCE rafta kalan fazlalığı söyler", async () => {
    // Rafta 26 valiz varken kapasiteyi 10'a cekmek, dukkani kendi beyan ettigi
    // sinirin 16 valiz ustunde birakir.
    mockPrisma.booking.aggregate.mockResolvedValue({
      _sum: { bagCountS: 20, bagCountM: 5, bagCountXl: 1 },
    });
    const r = await shopSettingsImpactService.assess({ shopId: "s1", capacity: 10 });
    expect(r.bagsOverCapacity).toBe(16);
  });

  it("kapasite YETİYORSA uyarı üretmez", async () => {
    mockPrisma.booking.aggregate.mockResolvedValue({
      _sum: { bagCountS: 3, bagCountM: null, bagCountXl: null },
    });
    const r = await shopSettingsImpactService.assess({ shopId: "s1", capacity: 10 });
    expect(r.bagsOverCapacity).toBe(0);
  });

  it("olmayan dükkanda sessizce sıfır döner", async () => {
    // Uyari uretmek icin patlamak, kaydin kendisini dusurmek olurdu.
    mockPrisma.shop.findUnique.mockResolvedValue(null);
    expect(await shopSettingsImpactService.assess({ shopId: "yok", capacity: 1 })).toEqual({
      bookingsOutsideHours: 0, bagsOverCapacity: 0,
    });
  });
});
