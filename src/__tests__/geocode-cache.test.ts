import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { geocodeCacheKey, getCachedPlaces, resetGeocodeCacheForTests, setCachedPlaces } from "@/lib/geocode-cache";
import { getRedis } from "@/lib/rate-limit";

/**
 * Yer aramasi onbellegi. CI `REDIS_URL` ile calisir: o zaman Redis yolu, yoksa
 * surec ici yol olculur. Iki yol da ayni sozlesmeyi tutmali.
 */
const KEY = geocodeCacheKey("Test  Yeri", "tr", "test");

beforeEach(async () => {
  await resetGeocodeCacheForTests([KEY]);
});

afterAll(async () => {
  await resetGeocodeCacheForTests([KEY]);
  getRedis()?.disconnect();
});

describe("geocode onbellegi", () => {
  it("anahtar bosluk ve buyuk/kucuk harf farkini yok sayar (Turkce I dahil)", () => {
    expect(geocodeCacheKey("  İSTANBUL   Havalimanı ", "tr", "s")).toBe(geocodeCacheKey("istanbul havalimanı", "tr", "s"));
    expect(geocodeCacheKey("x yz", "en", "s")).not.toBe(geocodeCacheKey("x yz", "de", "s"));
  });

  it("yazilan sonuc geri okunur, bos sonuc da", async () => {
    expect(await getCachedPlaces(KEY)).toBeNull();
    await setCachedPlaces(KEY, [{ lat: 41, lng: 29, label: "Yer" }]);
    expect(await getCachedPlaces(KEY)).toEqual([{ lat: 41, lng: 29, label: "Yer" }]);
    await setCachedPlaces(KEY, []);
    expect(await getCachedPlaces(KEY)).toEqual([]);
  });
});
