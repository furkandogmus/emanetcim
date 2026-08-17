import { describe, it, expect } from "vitest";
import {
  computeDailyBagLineTotal,
  computeServiceTotalForStay,
} from "@/lib/bag-pricing";
import { DEFAULT_PRICING_RULES, type PricingRules } from "@/lib/pricing-rules";

/** Boyut primi olmayan varsayılan kurallar (a82be7c: S=M=XL=1.0, Bounce ile eşleşir). */
const { S, M, XL } = DEFAULT_PRICING_RULES.bagMultipliers;

/** Boyut primi olan kurallar — çarpanların gerçekten uygulandığını kanıtlar. */
const tieredRules: PricingRules = {
  ...DEFAULT_PRICING_RULES,
  bagMultipliers: { S: 0.8, M: 1.0, XL: 1.5 },
};

describe("bag-pricing", () => {
  it("computeDailyBagLineTotal varsayılan kurallarda boyut primi uygulamaz", () => {
    expect(computeDailyBagLineTotal(80, 0, 1, 0)).toBe(80 * M);
    expect(computeDailyBagLineTotal(80, 1, 0, 0)).toBe(80 * S);
    expect(computeDailyBagLineTotal(80, 0, 0, 1)).toBe(80 * XL);
    // Düz fiyatlandırma: üç boyut da aynı tutar.
    expect(computeDailyBagLineTotal(80, 1, 0, 0)).toBe(
      computeDailyBagLineTotal(80, 0, 0, 1),
    );
  });

  it("computeDailyBagLineTotal verilen çarpanları uygular", () => {
    expect(computeDailyBagLineTotal(80, 1, 0, 0, tieredRules)).toBe(64);
    expect(computeDailyBagLineTotal(80, 0, 1, 0, tieredRules)).toBe(80);
    expect(computeDailyBagLineTotal(80, 0, 0, 1, tieredRules)).toBe(120);
  });

  it("computeServiceTotalForStay günlük satırı gün sayısıyla çarpar", () => {
    expect(computeServiceTotalForStay(80, 0, 1, 0, 1)).toBe(80 * M);
    expect(computeServiceTotalForStay(80, 0, 1, 0, 3)).toBe(80 * M * 3);
    expect(computeServiceTotalForStay(80, 1, 1, 0, 2)).toBe(
      (80 * S + 80 * M) * 2,
    );
    expect(computeServiceTotalForStay(80, 1, 1, 0, 2, tieredRules)).toBe(
      (64 + 80) * 2,
    );
  });

  it("kısmi günler yukarı yuvarlanır ve en az 1 gün sayılır", () => {
    expect(computeServiceTotalForStay(80, 0, 1, 0, 1.1)).toBe(80 * M * 2);
    expect(computeServiceTotalForStay(80, 0, 1, 0, 0)).toBe(80 * M);
  });
});
