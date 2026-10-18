import { describe, expect, it } from "@jest/globals";
import { estimate } from "../pricing";
import type { ShopDetail } from "../types";

const shop = {
  pricePerDay: 250,
  pricing: { bagMultiplierS: 0.8, bagMultiplierM: 1, bagMultiplierXl: 1.5, insuranceFeeTry: 30 },
} as unknown as ShopDetail;

describe("estimate", () => {
  it("valiz yoksa tutar ve sigorta sifirdir", () => {
    expect(estimate(shop, { s: 0, m: 0, xl: 0 }, 3)).toEqual({ lines: [], insurance: 0, total: 0 });
  });

  it("sunucu formulu: boy carpani x gun + tek sigorta", () => {
    // 2*200*2 + 1*375*2 + 30 = 800 + 750 + 30
    expect(estimate(shop, { s: 2, m: 0, xl: 1 }, 2).total).toBe(1580);
  });

  it("valiz ya da gun artinca tutar azalmaz", () => {
    const base = estimate(shop, { s: 1, m: 1, xl: 0 }, 1).total;
    expect(estimate(shop, { s: 1, m: 2, xl: 0 }, 1).total).toBeGreaterThan(base);
    expect(estimate(shop, { s: 1, m: 1, xl: 0 }, 2).total).toBeGreaterThan(base);
  });

  it("sonda 2 haneye yuvarlar", () => {
    const odd = { ...shop, pricePerDay: 33.333 } as ShopDetail;
    const total = estimate(odd, { s: 0, m: 1, xl: 0 }, 1).total;
    expect(total).toBe(Math.round((33.333 + 30) * 100) / 100);
  });
});
