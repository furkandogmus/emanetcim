import { describe, it, expect } from "vitest";
import {
  computeDailyBagLineTotal,
  computeServiceTotalForStay,
} from "@/lib/bag-pricing";

describe("bag-pricing", () => {
  it("computeDailyBagLineTotal matches S/M/XL multipliers (pricePerDay 80)", () => {
    expect(computeDailyBagLineTotal(80, 0, 1, 0)).toBe(80);
    expect(computeDailyBagLineTotal(80, 1, 0, 0)).toBe(64);
    expect(computeDailyBagLineTotal(80, 0, 0, 1)).toBe(120);
  });

  it("computeServiceTotalForStay multiplies daily line by days", () => {
    expect(computeServiceTotalForStay(80, 0, 1, 0, 1)).toBe(80);
    expect(computeServiceTotalForStay(80, 0, 1, 0, 3)).toBe(240);
    expect(computeServiceTotalForStay(80, 1, 1, 0, 2)).toBe((64 + 80) * 2);
  });
});
