import { describe, it, expect } from "vitest";
import { formatTryCurrency } from "@/lib/currency";

describe("currency", () => {
  it("formats TRY for display", () => {
    const s = formatTryCurrency(99.5, "tr-TR");
    expect(s).toContain("99");
  });
});
