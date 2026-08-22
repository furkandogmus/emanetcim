import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_PRICING_RULES } from "@/lib/pricing-rules";
import { toPricingSnapshot, readPricingSnapshot, SNAPSHOT_VERSION } from "@/lib/pricing-snapshot";

/**
 * Fiyat varsayılanlarının ayrışmasına karşı koruma.
 *
 * Neden var: 2026-08-22'de aynı kural için ÜÇ farklı doğruluk kaynağı vardı —
 * `schema.prisma` 1.0/1.0/1.0, `pricing-rules.ts` 0.8/1.0/1.5, prod'daki canlı satır
 * 1.0/1.0/1.0. Kod varsayılanı yalnızca DB satırı YOKKEN devreye girdiği ve prod'da
 * satır her zaman var olduğu için, kodda yapılan "düzeltme" prod'da hiç çalışmadı:
 * XL bavul küçük bavul fiyatı ödemeye devam etti (P0-3).
 *
 * Bu test şema ile kodu karşılaştırır. Ayrışırlarsa CI kırmızı yanar.
 */

const SCHEMA = fs.readFileSync(
  path.join(process.cwd(), "prisma/schema.prisma"),
  "utf8",
);

/** `PlatformSettings` bloğundan `@default(...)` değerlerini okur. */
function schemaDefaults(): Record<string, number> {
  const block = SCHEMA.match(/model PlatformSettings \{([\s\S]*?)\n\}/);
  expect(block, "PlatformSettings modeli schema.prisma'da bulunamadı").toBeTruthy();

  const out: Record<string, number> = {};
  for (const line of block![1].split("\n")) {
    const m = line.match(/^\s*(\w+)\s+\w+\s+@default\(([-\d.]+)\)/);
    if (m) out[m[1]] = Number(m[2]);
  }
  return out;
}

describe("fiyat varsayılanları — şema ile kod aynı olmalı", () => {
  const schema = schemaDefaults();

  const PAIRS: Array<[schemaField: string, codeValue: number]> = [
    ["maxStayDays", DEFAULT_PRICING_RULES.maxStayDays],
    ["maxBagsPerSlot", DEFAULT_PRICING_RULES.maxBagsPerSlot],
    ["insuranceFeeTry", DEFAULT_PRICING_RULES.insuranceFeeTry],
    ["earlyRefundRatio", DEFAULT_PRICING_RULES.earlyRefundRatio],
    ["cancelFixedFeeTry", DEFAULT_PRICING_RULES.cancelFixedFeeTry],
    ["latePickupFeeTry", DEFAULT_PRICING_RULES.latePickupFeeTry],
    ["latePickupGraceMin", DEFAULT_PRICING_RULES.latePickupGraceMin],
    ["defaultShopCapacity", DEFAULT_PRICING_RULES.defaultShopCapacity],
    ["defaultPricePerDay", DEFAULT_PRICING_RULES.defaultPricePerDay],
    ["bagMultiplierS", DEFAULT_PRICING_RULES.bagMultipliers.S],
    ["bagMultiplierM", DEFAULT_PRICING_RULES.bagMultipliers.M],
    ["bagMultiplierXl", DEFAULT_PRICING_RULES.bagMultipliers.XL],
  ];

  it.each(PAIRS)(
    "%s şemadaki @default ile DEFAULT_PRICING_RULES'da aynı",
    (field, codeValue) => {
      expect(
        schema[field],
        `schema.prisma → PlatformSettings.${field} @default() bulunamadı`,
      ).toBeTypeOf("number");
      expect(schema[field]).toBe(codeValue);
    },
  );

  it("boy çarpanları gerçekten farklı — hepsi 1.0 ise boy bazlı fiyat ölü demektir", () => {
    const { S, M, XL } = DEFAULT_PRICING_RULES.bagMultipliers;
    expect(new Set([S, M, XL]).size).toBeGreaterThan(1);
    expect(S).toBeLessThan(M);
    expect(XL).toBeGreaterThan(M);
  });

  it("gecikme ücreti iptal ücretinden ayrı bir alan — ödünç alınmıyor", () => {
    expect(DEFAULT_PRICING_RULES).toHaveProperty("latePickupFeeTry");
    expect(DEFAULT_PRICING_RULES).toHaveProperty("latePickupGraceMin");
    expect(SCHEMA).toContain("latePickupFeeTry");
  });
});

describe("fiyat anlık kopyası", () => {
  it("kuralları sürüm ve zaman damgasıyla birlikte yazar", () => {
    const at = new Date("2026-08-22T09:00:00.000Z");
    const snap = toPricingSnapshot(DEFAULT_PRICING_RULES, at) as Record<string, unknown>;

    expect(snap.v).toBe(SNAPSHOT_VERSION);
    expect(snap.at).toBe("2026-08-22T09:00:00.000Z");
    expect(snap.insuranceFeeTry).toBe(DEFAULT_PRICING_RULES.insuranceFeeTry);
    expect(snap.bagMultipliers).toEqual(DEFAULT_PRICING_RULES.bagMultipliers);
  });

  it("yazılan kopya geri okunabiliyor", () => {
    const snap = toPricingSnapshot(DEFAULT_PRICING_RULES);
    const read = readPricingSnapshot(snap);
    expect(read?.insuranceFeeTry).toBe(DEFAULT_PRICING_RULES.insuranceFeeTry);
    expect(read?.maxStayDays).toBe(DEFAULT_PRICING_RULES.maxStayDays);
  });

  it("kopya yoksa null döner — bugünkü kuralları UYDURMAZ", () => {
    // Bu migrasyondan önceki rezervasyonlarda kopya gerçekten yok ve o kayıtlar
    // için hangi kuralın geçerli olduğu bilinmiyor. Bugünküleri varsaymak P0-4'ün
    // yarattığı yanlış güveni tekrar üretmek olurdu.
    expect(readPricingSnapshot(null)).toBeNull();
    expect(readPricingSnapshot(undefined)).toBeNull();
    expect(readPricingSnapshot({})).toBeNull();
    expect(readPricingSnapshot([])).toBeNull();
    expect(readPricingSnapshot("{}")).toBeNull();
    expect(readPricingSnapshot({ v: 1 })).toBeNull();
  });
});
