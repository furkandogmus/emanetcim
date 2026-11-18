import { describe, it, expect } from "vitest";
import { snapStayToShopHours } from "@/lib/stay-days";

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

  it("alis acilistan onceyse acilisa ceker", () => {
    const r = snapStayToShopHours(shop, at("2026-11-20T10:00"), at("2026-11-21T07:00"))!;
    expect(r.checkOut).toEqual(at("2026-11-21T09:00"));
    expect(r.pickup).toEqual({ at: "09:00", reason: "opens" });
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
