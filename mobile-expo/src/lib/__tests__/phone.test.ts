import { describe, expect, it } from "@jest/globals";

import { telUrl, waUrl } from "@/lib/phone";

describe("telUrl", () => {
  it("uluslararası numara varsa +ile arar", () => {
    expect(telUrl("0532 000 00 00", "905320000000")).toBe("tel:+905320000000");
  });
  it("yoksa ham numarayı kullanır", () => {
    expect(telUrl("0532 000 00 00", null)).toBe("tel:0532 000 00 00");
  });
});

describe("waUrl", () => {
  it("wa.me bağlantısı kurar", () => {
    expect(waUrl("905320000000")).toBe("https://wa.me/905320000000");
  });
});
