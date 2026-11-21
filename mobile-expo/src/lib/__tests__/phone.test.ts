import { describe, expect, it } from "@jest/globals";

import { normalizeTrGsm10, whatsappNumber } from "../phone";

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
