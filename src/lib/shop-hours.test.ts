import { describe, it, expect } from "vitest";
import { isShopOpenAt, isShopOpenForStay } from "./shop-hours";

describe("isShopOpenAt Timezone Check", () => {
  it("should correctly identify opening hours in Turkey (UTC+3) regardless of UTC input", () => {
    // 09:00 - 18:00
    const openTime = "09:00";
    const closeTime = "18:00";

    // 07:00 UTC is 10:00 Istanbul (should be OPEN)
    const atUtc7 = new Date("2026-04-17T07:00:00Z");
    expect(isShopOpenAt(openTime, closeTime, atUtc7)).toBe(true);

    // 05:00 UTC is 08:00 Istanbul (should be CLOSED)
    const atUtc5 = new Date("2026-04-17T05:00:00Z");
    expect(isShopOpenAt(openTime, closeTime, atUtc5)).toBe(false);

    // 15:00 UTC is 18:00 Istanbul (should be OPEN - edge case exactly at closing)
    const atUtc15 = new Date("2026-04-17T15:00:00Z");
    expect(isShopOpenAt(openTime, closeTime, atUtc15)).toBe(true);
    
    // 15:01 UTC is 18:01 Istanbul (should be CLOSED)
    const atUtc1501 = new Date("2026-04-17T15:01:00Z");
    expect(isShopOpenAt(openTime, closeTime, atUtc1501)).toBe(false);
  });

  it("should handle overnight shifts (e.g. 22:00 - 02:00)", () => {
    const openTime = "22:00";
    const closeTime = "02:00";

    // 21:00 UTC is 00:00 Istanbul (should be OPEN)
    const atUtc21 = new Date("2026-04-17T21:00:00Z");
    expect(isShopOpenAt(openTime, closeTime, atUtc21)).toBe(true);

    // 18:00 UTC is 21:00 Istanbul (should be CLOSED)
    const atUtc18 = new Date("2026-04-17T18:00:00Z");
    expect(isShopOpenAt(openTime, closeTime, atUtc18)).toBe(false);
  });
});

describe("isShopOpenForStay", () => {
  it("allows an overnight stay when a non-24/7 shop is open at drop-off and pick-up, even though it is closed at midnight in between", () => {
    // 09:00 - 20:00, Istanbul. Drop off today 13:00, pick up tomorrow 13:00 —
    // the shop is closed overnight but the bag just sits there unattended.
    const checkIn = new Date("2026-08-22T10:00:00Z"); // 13:00 Istanbul
    const checkOut = new Date("2026-08-23T10:00:00Z"); // 13:00 Istanbul next day
    expect(
      isShopOpenForStay("09:00", "20:00", false, checkIn, checkOut),
    ).toBe(true);
  });

  it("rejects a stay when the shop is closed at check-in or check-out", () => {
    const checkIn = new Date("2026-08-22T04:00:00Z"); // 07:00 Istanbul, before 09:00 open
    const checkOut = new Date("2026-08-23T10:00:00Z"); // 13:00 Istanbul
    expect(
      isShopOpenForStay("09:00", "20:00", false, checkIn, checkOut),
    ).toBe(false);
  });
});
