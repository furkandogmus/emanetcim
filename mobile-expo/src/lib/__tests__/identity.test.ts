import { describe, expect, it } from "@jest/globals";

import {
  applyIdentityInput,
  looksLikePhone,
  normalizeTrGsm10,
  parseIdentity,
  parsePhone,
  switchIdentityMode,
} from "@/lib/identity";

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

describe("applyIdentityInput / switchIdentityMode", () => {
  const empty = { mode: "email" as const, email: "", phone: "" };

  it("kilitsizken 3 rakamda telefona gecer", () => {
    expect(applyIdentityInput(empty, "190", false)).toEqual({ mode: "phone", email: "", phone: "190" });
  });

  it("sekmeyle e-postaya donen kullanici '190ahmet@x.com' yazabilir (tuzak yok)", () => {
    let s = applyIdentityInput(empty, "190", false);
    s = switchIdentityMode(s, "email");
    expect(s).toEqual({ mode: "email", email: "190", phone: "" });
    s = applyIdentityInput(s, "190", true);
    expect(s.mode).toBe("email");
    s = applyIdentityInput(s, "190ahmet@x.com", true);
    expect(s).toEqual({ mode: "email", email: "190ahmet@x.com", phone: "" });
  });

  it("kilitliyken e-posta kutusuna yalniz rakam yazmak modu degistirmez", () => {
    expect(applyIdentityInput(empty, "05321234567", true).mode).toBe("email");
  });

  it("telefon kutusuna harf/@ gelirse kilitli de olsa e-postaya doner", () => {
    const phone = { mode: "phone" as const, email: "", phone: "532" };
    expect(applyIdentityInput(phone, "ahmet@x.com", true)).toEqual({ mode: "email", email: "ahmet@x.com", phone: "" });
  });

  it("e-posta -> telefon sekmesi telefon gibi metni tasir, e-postayi telefona dokmez", () => {
    expect(switchIdentityMode({ mode: "email", email: "0532", phone: "" }, "phone")).toEqual({
      mode: "phone",
      email: "",
      phone: "0532",
    });
    expect(switchIdentityMode({ mode: "email", email: "a@b.co", phone: "" }, "phone")).toEqual({
      mode: "phone",
      email: "a@b.co",
      phone: "",
    });
  });
});
