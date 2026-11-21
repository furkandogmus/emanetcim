import { describe, expect, it } from "@jest/globals";

import { looksLikePhone, normalizeTrGsm10, parseIdentity, parsePhone } from "@/lib/identity";

describe("parseIdentity", () => {
  it("e-postayi kucuk harfe cevirir", () => {
    expect(parseIdentity(" Esnaf@Test.com ")).toEqual({ email: "esnaf@test.com" });
  });
  it("telefonu sunucunun gordugu 10 haneye indirir", () => {
    expect(parseIdentity("0532 123 45 67")).toEqual({ phone: "5321234567" });
    expect(parseIdentity("+90 (532) 123-45-67")).toEqual({ phone: "5321234567" });
    expect(parseIdentity("5321234567")).toEqual({ phone: "5321234567" });
  });
  it("gecersizi reddeder", () => {
    expect(parseIdentity("esnaf")).toBeNull();
    expect(parseIdentity("a@b")).toBeNull();
    expect(parseIdentity("12345")).toBeNull();
    expect(parseIdentity("0532abc1234")).toBeNull();
  });
  it("Turkiye cep numarasi olmayan 10-12 haneyi reddeder (sunucu invalid_format donerdi)", () => {
    expect(parseIdentity("4441234567")).toBeNull();
    expect(parseIdentity("+44 7911 123456")).toBeNull();
    expect(parseIdentity("02121234567")).toBeNull();
  });
});

describe("normalizeTrGsm10", () => {
  it("uc bicimi de ayni sonuca indirir", () => {
    expect(normalizeTrGsm10("05321234567")).toBe("5321234567");
    expect(normalizeTrGsm10("905321234567")).toBe("5321234567");
    expect(normalizeTrGsm10("532 123 45 67")).toBe("5321234567");
    expect(normalizeTrGsm10("532123456")).toBeNull();
  });
});

describe("parsePhone", () => {
  it("yalnizca TR cep numarasi", () => {
    expect(parsePhone("0532 123 45 67")).toEqual({ phone: "5321234567" });
    expect(parsePhone("a@b.co")).toBeNull();
  });
});

describe("looksLikePhone", () => {
  it("rakamla baslayan, @ icermeyen metni telefon sayar", () => {
    expect(looksLikePhone("0532")).toBe(true);
    expect(looksLikePhone("+90 532")).toBe(true);
    expect(looksLikePhone("532 123")).toBe(true);
  });
  it("e-postayi ve cok kisa girdiyi saymaz", () => {
    expect(looksLikePhone("ahmet@x.com")).toBe(false);
    expect(looksLikePhone("34ahmet")).toBe(false);
    expect(looksLikePhone("05")).toBe(false);
    expect(looksLikePhone("")).toBe(false);
  });
});
