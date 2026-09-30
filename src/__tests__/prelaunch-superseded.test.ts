import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  OPERATING_SHOP_FILTER,
  PRELAUNCH_NOT_SUPERSEDED_SQL_CONDITION,
  PRELAUNCH_SUPERSEDED_RADIUS_KM,
  hideSupersededPrelaunch,
} from "@/lib/public-shop-filter";

/**
 * Yakınında gerçek esnaf açılan talep testi noktası misafirden gizlenir
 * (bkz. `PRELAUNCH_SUPERSEDED_RADIUS_KM`). Koordinatlar canlıdaki ilk örnek:
 * Alanya, Merlin Home Tekstil ↔ Alanya Kalesi Emanet Noktası (~1,8 km).
 */

const base = { isActive: true, isTest: false, isPrelaunch: false };
const MERLIN = { ...base, id: "merlin", latitude: 36.548227, longitude: 31.998708 };
const KALE = { ...base, id: "kale", isPrelaunch: true, latitude: 36.53311, longitude: 31.99056 };
const LARA = { ...base, id: "lara", isPrelaunch: true, latitude: 36.84933, longitude: 30.8345 };

describe("hideSupersededPrelaunch", () => {
  it("2 km içinde işleyen esnaf varsa prelaunch noktasını düşürür", () => {
    const ids = hideSupersededPrelaunch([MERLIN, KALE, LARA]).map((s) => s.id);
    expect(ids).toEqual(["merlin", "lara"]);
  });

  it("esnaf yoksa prelaunch noktası görünür kalır", () => {
    expect(hideSupersededPrelaunch([KALE, LARA]).map((s) => s.id)).toEqual(["kale", "lara"]);
  });

  it("2 km dışındaki esnaf gizlemez", () => {
    // ~2,5 km kuzey
    const far = { ...MERLIN, id: "far", latitude: 36.5557, longitude: 31.99056 };
    expect(hideSupersededPrelaunch([far, KALE]).map((s) => s.id)).toEqual(["far", "kale"]);
  });

  it.each([
    ["pasif", { isActive: false }],
    ["test", { isTest: true }],
    ["başka bir prelaunch", { isPrelaunch: true }],
    ["koordinatsız", { latitude: null, longitude: null }],
  ])("%s dükkan gizlemez", (_label, patch) => {
    const other = { ...MERLIN, ...patch };
    expect(hideSupersededPrelaunch([other, KALE]).map((s) => s.id)).toContain("kale");
  });
});

describe("PRELAUNCH_NOT_SUPERSEDED_SQL_CONDITION", () => {
  it("iç sorgu işleyen dükkan filtresinin her alanını `o` takma adıyla taşır", () => {
    for (const field of Object.keys(OPERATING_SHOP_FILTER)) {
      expect(PRELAUNCH_NOT_SUPERSEDED_SQL_CONDITION).toContain(`o."${field}"`);
    }
  });

  it("yarıçap sabitle aynı (metre)", () => {
    expect(PRELAUNCH_NOT_SUPERSEDED_SQL_CONDITION).toContain(
      String(PRELAUNCH_SUPERSEDED_RADIUS_KM * 1000),
    );
  });

  it("yalnızca prelaunch satırını hedefler", () => {
    expect(PRELAUNCH_NOT_SUPERSEDED_SQL_CONDITION).toMatch(/s\."isPrelaunch" = true/);
  });

  it("arama sorgusu ve yedek yol kuralı kullanıyor", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/lib/shop-distance-postgis.ts"),
      "utf8",
    );
    expect(src).toContain("PRELAUNCH_NOT_SUPERSEDED_SQL_CONDITION");
    expect(src).toContain("hideSupersededPrelaunch(");
  });
});
