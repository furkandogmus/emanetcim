import { describe, it, expect } from "vitest";
import { nextOpening, snapStayToShopHours } from "@/lib/stay-days";

// Istanbul UTC+3. 2026-11-20 Cuma.
const at = (local: string) => new Date(`${local}:00+03:00`);
const shop = { openingTime: "09:00", closingTime: "20:00", timeZone: "Europe/Istanbul" };

describe("snapStayToShopHours", () => {
  it("saat icindeyse dokunmaz", () => {
    const r = snapStayToShopHours(shop, at("2026-11-20T10:00"), at("2026-11-20T18:00"));
    expect(r).toEqual({ checkIn: at("2026-11-20T10:00"), checkOut: at("2026-11-20T18:00") });
  });

  it("alis kapanistan sonraysa kapanisa ceker", () => {
    const r = snapStayToShopHours(shop, at("2026-11-20T10:00"), at("2026-11-20T22:00"))!;
    expect(r.checkOut).toEqual(at("2026-11-20T20:00"));
    expect(r.pickup).toEqual({ at: "20:00", reason: "closes" });
  });

  it("birakis acilistan onceyse acilisa ceker", () => {
    const r = snapStayToShopHours(shop, at("2026-11-20T07:30"), at("2026-11-21T12:00"))!;
    expect(r.checkIn).toEqual(at("2026-11-20T09:00"));
    expect(r.drop).toEqual({ at: "09:00", reason: "opens" });
  });

  it("alis acilistan onceyse ONCEKI gunun kapanisina ceker (kalis uzamaz)", () => {
    const r = snapStayToShopHours(shop, at("2026-11-20T10:00"), at("2026-11-21T07:00"))!;
    expect(r.checkOut).toEqual(at("2026-11-20T20:00"));
    expect(r.pickup).toEqual({ at: "20:00", reason: "closes" });
  });

  it("onceki kapanis birakisa cok yakinsa acilisa ceker", () => {
    const r = snapStayToShopHours(shop, at("2026-11-20T19:30"), at("2026-11-21T07:00"))!;
    expect(r.checkOut).toEqual(at("2026-11-21T09:00"));
    expect(r.pickup).toEqual({ at: "09:00", reason: "opens" });
  });

  it("gunlere gore farkli saatte gun sayisi artmaz", () => {
    // Cumartesi 08-20, pazar 10-18. Cumartesi 08:00 -> pazar 07:30 (23.5 saat, 1 gun).
    const weekly = [
      { weekday: 6, isClosed: false, openingTime: "08:00", closingTime: "20:00" },
      { weekday: 7, isClosed: false, openingTime: "10:00", closingTime: "18:00" },
    ];
    const r = snapStayToShopHours({ ...shop, weekly }, at("2026-11-21T08:00"), at("2026-11-22T07:30"))!;
    expect(r.checkOut).toEqual(at("2026-11-21T20:00"));
    expect(r.checkOut.getTime() - r.checkIn.getTime()).toBeLessThanOrEqual(24 * 3600_000);
  });

  it("birakis kapanistan sonraysa ya da gun kapaliysa null", () => {
    expect(snapStayToShopHours(shop, at("2026-11-20T21:00"), at("2026-11-21T12:00"))).toBeNull();
    const closedSat = {
      ...shop,
      weekly: [{ weekday: 6, isClosed: true, openingTime: "09:00", closingTime: "20:00" }],
    };
    expect(snapStayToShopHours(closedSat, at("2026-11-20T10:00"), at("2026-11-21T12:00"))).toBeNull();
  });

  it("7/24 dukkana dokunmaz", () => {
    const r = snapStayToShopHours({ open247: true }, at("2026-11-20T03:00"), at("2026-11-20T23:00"));
    expect(r?.checkIn).toEqual(at("2026-11-20T03:00"));
  });
});

describe("nextOpening", () => {
  it("kapanistan sonra aranirsa ertesi gunun acilisi", () => {
    expect(nextOpening(shop, at("2026-11-20T21:00"))).toEqual({ date: "2026-11-21", at: "09:00" });
  });

  it("acilistan once aranirsa ayni gunun acilisi", () => {
    expect(nextOpening(shop, at("2026-11-20T07:00"))).toEqual({ date: "2026-11-20", at: "09:00" });
  });

  it("kapali gunleri (pazar) atlar, eski openingTime degil haftalik satiri kullanir", () => {
    const weekly = [
      { weekday: 6, isClosed: false, openingTime: "10:00", closingTime: "18:00" },
      { weekday: 7, isClosed: true, openingTime: "09:00", closingTime: "20:00" },
      { weekday: 1, isClosed: false, openingTime: "08:30", closingTime: "20:00" },
    ];
    // 2026-11-21 Cumartesi 19:00 -> pazar kapali -> pazartesi 08:30
    expect(nextOpening({ ...shop, weekly }, at("2026-11-21T19:00"))).toEqual({ date: "2026-11-23", at: "08:30" });
  });

  it("izin gunlerini atlar", () => {
    const closures = [{ startDate: "2026-11-21", endDate: "2026-11-22" }];
    expect(nextOpening({ ...shop, closures }, at("2026-11-20T21:00"))).toEqual({ date: "2026-11-23", at: "09:00" });
  });
});
