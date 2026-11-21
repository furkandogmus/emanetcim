import { describe, expect, it } from "@jest/globals";

import { isBelowMinVersion, parseVersion } from "@/lib/app-update";

/**
 * Zorunlu guncelleme kapisi: yanlis karsilastirma ya eski surumu iceri alir ya da
 * guncel kullaniciyi "Guncelleme gerekli" ekraninda kilitler.
 */
describe("parseVersion", () => {
  it("surumu sayilara ayirir, eksik parcayi 0 sayar", () => {
    expect(parseVersion("0.3.3")).toEqual([0, 3, 3]);
    expect(parseVersion("v1.2")).toEqual([1, 2, 0]);
    expect(parseVersion("2")).toEqual([2, 0, 0]);
  });
  it("bos ya da bozuk girdide null doner", () => {
    expect(parseVersion(null)).toBeNull();
    expect(parseVersion("")).toBeNull();
    expect(parseVersion("abc")).toBeNull();
  });
});

describe("isBelowMinVersion", () => {
  it("sayisal karsilastirir (0.10.0 > 0.9.0)", () => {
    expect(isBelowMinVersion("0.9.0", "0.10.0")).toBe(true);
    expect(isBelowMinVersion("0.10.0", "0.9.0")).toBe(false);
  });
  it("esit surumde kapi kapanmaz", () => {
    expect(isBelowMinVersion("0.3.3", "0.3.3")).toBe(false);
  });
  it("kucuk surumde kapanir", () => {
    expect(isBelowMinVersion("0.3.3", "0.4.0")).toBe(true);
    expect(isBelowMinVersion("0.3.3", "1.0.0")).toBe(true);
  });
  it("minimum yoksa ya da surum bilinmiyorsa kapi acik kalir", () => {
    expect(isBelowMinVersion("0.3.3", null)).toBe(false);
    expect(isBelowMinVersion(null, "1.0.0")).toBe(false);
    expect(isBelowMinVersion("0.3.3", "bozuk")).toBe(false);
  });
});
