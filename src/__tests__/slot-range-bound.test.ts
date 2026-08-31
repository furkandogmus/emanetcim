import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * SLOT MUSAITLIK UCU SINIRSIZ ARALIK KABUL ETMEZ.
 *
 * NEDEN VAR (2026-08-31'de olculdu): `from` ve `to` sorgu parametreleri
 * dogrudan `getSlotAvailability`ye geciyordu ve orada `shopTimeSlot.findMany`
 * `take` ALMIYORDU. Yani
 *
 *     GET /api/shops/<id>/slots?from=1970-01-01&to=2100-01-01
 *
 * o dukkanin butun slot satirlarini cekiyor, kimliklerini bir `groupBy`'in
 * `IN` listesine koyuyor ve hepsini JSON'a seriliyordu -- KIMLIK DOGRULAMASI
 * OLMAYAN bir ucta.
 *
 * Bugunku hacimde bedeli sinirli, ama bedelin ISTEKLE degil TABLOYLA sinirli
 * olmasi bir tasarim degil tesadüf: veri buyudukce buyuyor.
 *
 * Arayuz TEK GUNLUK pencere istiyor (`SlotAvailabilityGrid` -> `dayWindow`),
 * en uzun konaklama 30 gun (`pricing-rules`). 31 gunluk sinir ikisini de
 * rahatca karsiliyor -- yani bu kisitlama hicbir gercek kullanimi kesmiyor.
 *
 * Ayrica `to <= from` hic kontrol edilmiyordu: ters aralik BOS sonuc
 * donduruyordu, yani istemci "musait slot yok" ile "yanlis parametre
 * gonderdim" durumlarini ayirt edemiyordu.
 */

const { mockGetSlotAvailability } = vi.hoisted(() => ({
  mockGetSlotAvailability: vi.fn(),
}));

vi.mock("@/services/SlotService", () => ({
  getSlotAvailability: mockGetSlotAvailability,
}));

import { handleSlotAvailability } from "@/lib/slot-availability-route";
import { NextRequest } from "next/server";

function call(from: string, to: string) {
  const url = `https://ornek.test/api/shops/s1/slots?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  return handleSlotAvailability(
    new NextRequest(url),
    Promise.resolve({ id: "s1" }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSlotAvailability.mockResolvedValue([]);
});

describe("slot musaitlik aralik siniri", () => {
  it("tek gunluk pencere kabul edilir (arayuzun gercekte istedigi)", async () => {
    const res = await call("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z");
    expect(res.status).toBe(200);
    expect(mockGetSlotAvailability).toHaveBeenCalledOnce();
  });

  it("30 gunluk pencere kabul edilir (en uzun konaklama)", async () => {
    const res = await call("2026-09-01T00:00:00.000Z", "2026-10-01T00:00:00.000Z");
    expect(res.status).toBe(200);
  });

  it("yuz yillik aralik REDDEDILIR ve servise hic gitmez", async () => {
    const res = await call("1970-01-01T00:00:00.000Z", "2100-01-01T00:00:00.000Z");
    expect(res.status).toBe(400);
    expect(
      mockGetSlotAvailability,
      "sinir kontrolu sorgudan ONCE olmali; sonra olsa maliyet zaten dogar",
    ).not.toHaveBeenCalled();
  });

  it("ters aralik 400 doner (bos sonuc DEGIL)", async () => {
    const res = await call("2026-09-02T00:00:00.000Z", "2026-09-01T00:00:00.000Z");
    expect(res.status).toBe(400);
    expect(mockGetSlotAvailability).not.toHaveBeenCalled();
  });

  it("ayni an (sifir genislik) de 400", async () => {
    const t = "2026-09-01T00:00:00.000Z";
    const res = await call(t, t);
    expect(res.status).toBe(400);
  });

  it("gecersiz tarih bicimi 400", async () => {
    const res = await call("dun", "yarin");
    expect(res.status).toBe(400);
    expect(mockGetSlotAvailability).not.toHaveBeenCalled();
  });
});
