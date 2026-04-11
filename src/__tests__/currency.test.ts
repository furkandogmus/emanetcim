import { describe, it, expect } from "vitest";
import {
  tryAmountToStripeMinorUnits,
  formatTryCurrency,
} from "@/lib/currency";

describe("currency", () => {
  it("converts TRY to Stripe minor units", () => {
    expect(tryAmountToStripeMinorUnits(10)).toBe(1000);
    expect(tryAmountToStripeMinorUnits(12.34)).toBe(1234);
  });

  it("rejects invalid amounts", () => {
    expect(() => tryAmountToStripeMinorUnits(NaN)).toThrow();
    expect(() => tryAmountToStripeMinorUnits(-1)).toThrow();
  });

  it("formats TRY for display", () => {
    const s = formatTryCurrency(99.5, "tr-TR");
    expect(s).toContain("99");
  });
});
