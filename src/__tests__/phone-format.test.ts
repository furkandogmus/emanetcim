import { describe, expect, it } from "vitest";
import { formatPhoneForDisplay, phoneDialHref } from "@/lib/phone-format";

describe("phone-format", () => {
  it("10 haneli TR cep numarasini 0'la gosterir", () => {
    expect(formatPhoneForDisplay("5535550000")).toBe("0553 555 00 00");
    expect(formatPhoneForDisplay("+90 553 555 00 00")).toBe("0553 555 00 00");
    expect(formatPhoneForDisplay("05535550000")).toBe("0553 555 00 00");
  });
  it("tanimadigi bicimi ve bosu bozmaz", () => {
    expect(formatPhoneForDisplay("+49 170 0000000")).toBe("+49 170 0000000");
    expect(formatPhoneForDisplay("  ")).toBeUndefined();
    expect(formatPhoneForDisplay(null)).toBeUndefined();
  });
  it("arama baglantisi TR numarada ulke koduyla", () => {
    expect(phoneDialHref("5535550000")).toBe("tel:+905535550000");
    expect(phoneDialHref("+49 170 0000000")).toBe("tel:+491700000000");
    expect(phoneDialHref("")).toBeUndefined();
  });
});
