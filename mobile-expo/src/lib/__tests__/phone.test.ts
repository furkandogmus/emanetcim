import { describe, expect, it } from "@jest/globals";

import { dialUrl, formatPhone, normalizeTrGsm10, telUrl, waUrl, whatsappNumber } from "@/lib/phone";

describe("whatsappNumber", () => {
  it("Turkiye cep numarasi: yerel ve 90'li bicimler 90 ile kurulur", () => {
    expect(whatsappNumber("0532 123 45 67")).toBe("905321234567");
    expect(whatsappNumber("5321234567")).toBe("905321234567");
    expect(whatsappNumber("+90 532 123 45 67")).toBe("905321234567");
  });
  it("acik ulke kodlu yabanci numara oldugu gibi gider", () => {
    expect(whatsappNumber("+49 170 1234567")).toBe("491701234567");
    expect(whatsappNumber("0049 170 1234567")).toBe("491701234567");
  });
  it("ulusal bicimli yabanci numara Turk numarasi sayilmaz", () => {
    expect(whatsappNumber("0170 1234567")).toBeNull();
    expect(whatsappNumber("8 912 345 67 89")).toBeNull();
    expect(whatsappNumber("")).toBeNull();
    expect(whatsappNumber(undefined)).toBeNull();
  });
  it("normalizeTrGsm10 gecersizi reddeder", () => {
    expect(normalizeTrGsm10("0212 123 45 67")).toBeNull();
  });
});

describe("telUrl", () => {
  it("uluslararası numara varsa +ile arar", () => {
    expect(telUrl("0532 000 00 00", "905320000000")).toBe("tel:+905320000000");
  });
  it("yoksa numarayi ulke koduyla arar", () => {
    expect(telUrl("0532 000 00 00", null)).toBe("tel:+905320000000");
  });
});

describe("waUrl", () => {
  it("wa.me bağlantısı kurar", () => {
    expect(waUrl("905320000000")).toBe("https://wa.me/905320000000");
  });
});

describe("dialUrl / formatPhone", () => {
  it("10 haneli TR cep numarasi 0'siz aranmaz, 0'la gosterilir", () => {
    expect(dialUrl("5535550000")).toBe("tel:+905535550000");
    expect(telUrl("5535550000")).toBe("tel:+905535550000");
    expect(formatPhone("5535550000")).toBe("0553 555 00 00");
    expect(formatPhone("+90 553 555 00 00")).toBe("0553 555 00 00");
  });
  it("yabanci numara oldugu gibi", () => {
    expect(dialUrl("+49 170 0000000")).toBe("tel:+491700000000");
    expect(formatPhone("+49 170 0000000")).toBe("+49 170 0000000");
    expect(formatPhone(null)).toBe("");
  });
});
