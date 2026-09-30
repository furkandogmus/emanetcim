import { describe, it, expect } from "vitest";
import { formatApproxForeign, formatTryCurrency } from "@/lib/currency";

describe("currency", () => {
  it("formats TRY for display", () => {
    const s = formatTryCurrency(99.5, "tr-TR");
    expect(s).toContain("99");
  });
});

describe("formatApproxForeign", () => {
  it("Türkçe'de yabancı karşılık göstermez", () => {
    expect(formatApproxForeign(250, "tr")).toBeNull();
  });

  it("250 TL: euro dillerinde ≈ €4,50, diğerlerinde ≈ $5", () => {
    expect(formatApproxForeign(250, "de")).toMatch(/^≈ 4,50\s€$/);
    expect(formatApproxForeign(250, "en")).toBe("≈ $5");
  });

  it("0'a yuvarlanan tutarı göstermez", () => {
    expect(formatApproxForeign(10, "en")).toBeNull();
  });
});
