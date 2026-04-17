import { describe, it, expect } from "vitest";
import { isShopOpenAt } from "./shop-hours";

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
