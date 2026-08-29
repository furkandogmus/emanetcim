import { describe, expect, it } from "vitest";
import {
  formatTrIban,
  isValidTckn,
  isValidTrIban,
  isValidVkn,
  normalizeTrIban,
} from "@/lib/tr/identity";

/**
 * Bu testler alt üye iş yeri onboarding'inin kapısını tutuyor. Yanlış bir
 * checksum, esnafı "belgeleriniz hatalı" duvarına çarpar ya da daha kötüsü
 * hatalı IBAN'ı PSP'ye gönderir ve hakediş yanlış hesaba gider.
 */
describe("TCKN", () => {
  it("gecerli numarayi kabul eder", () => {
    // Yaygin kullanilan gecerli test degeri (gercek bir kisiye ait degil).
    expect(isValidTckn("10000000146")).toBe(true);
  });

  it("11 haneden kisa/uzun olani reddeder", () => {
    expect(isValidTckn("1000000014")).toBe(false);
    expect(isValidTckn("100000001466")).toBe(false);
  });

  it("0 ile baslayani reddeder", () => {
    expect(isValidTckn("01000000146")).toBe(false);
  });

  it("ilk on hanesi ayni olani POLITIKA GEREGI reddeder", () => {
    // DIKKAT: 11111111110 resmi NVI checksum'undan GECER. Reddedilmesi
    // algoritmanin degil, bu urunun kabul politikasinin sonucudur --
    // src/lib/tr/identity.ts icindeki gerekceye bakin.
    expect(isValidTckn("11111111110")).toBe(false);
    expect(isValidTckn("22222222220")).toBe(false);
  });

  it("son hanesi bozulmus numarayi reddeder", () => {
    expect(isValidTckn("10000000147")).toBe(false);
  });

  it("10. hanesi bozulmus numarayi reddeder", () => {
    expect(isValidTckn("10000000156")).toBe(false);
  });

  it("bosluk ve tireyi tolere eder", () => {
    expect(isValidTckn("100 0000 0146")).toBe(true);
    expect(isValidTckn("10000000-146")).toBe(true);
  });

  it("harf iceren girdiyi reddeder", () => {
    expect(isValidTckn("1000000014A")).toBe(false);
  });
});

describe("VKN", () => {
  it("10 haneden farkli uzunlugu reddeder", () => {
    expect(isValidVkn("123456789")).toBe(false);
    expect(isValidVkn("12345678901")).toBe(false);
  });

  it("tum haneleri ayni olani reddeder", () => {
    expect(isValidVkn("1111111111")).toBe(false);
  });

  it("checksum'i tutan numarayi kabul, bozulani reddeder", () => {
    // Algoritmayla uretilmis gecerli bir VKN bulunur; son hanesi degistirilince
    // reddedilmeli. Boylece test sabit bir degere degil, kurala baglanir.
    let valid: string | null = null;
    for (let n = 1000000000; n < 1000000200 && !valid; n++) {
      const s = String(n);
      if (isValidVkn(s)) valid = s;
    }
    expect(valid).not.toBeNull();
    const v = valid as string;
    const last = Number(v[9]);
    const broken = v.slice(0, 9) + String((last + 1) % 10);
    expect(isValidVkn(v)).toBe(true);
    expect(isValidVkn(broken)).toBe(false);
  });
});

describe("TR IBAN", () => {
  it("gecerli TR IBAN'i kabul eder", () => {
    expect(isValidTrIban("TR330006100519786457841326")).toBe(true);
  });

  it("bosluklu yazimi kabul eder", () => {
    expect(isValidTrIban("TR33 0006 1005 1978 6457 8413 26")).toBe(true);
  });

  it("kontrol hanesi bozulani reddeder", () => {
    expect(isValidTrIban("TR340006100519786457841326")).toBe(false);
  });

  it("TR disi ulke kodunu reddeder", () => {
    // Gecerli bir Alman IBAN'i bile olsa bu alan yalnizca TR kabul eder.
    expect(isValidTrIban("DE89370400440532013000")).toBe(false);
  });

  it("yanlis uzunlugu reddeder", () => {
    expect(isValidTrIban("TR33000610051978645784132")).toBe(false);
    expect(isValidTrIban("TR3300061005197864578413267")).toBe(false);
  });

  it("normalize ve format birbirinin tersi", () => {
    const raw = "TR330006100519786457841326";
    expect(normalizeTrIban(formatTrIban(raw))).toBe(raw);
    expect(formatTrIban(raw)).toBe("TR33 0006 1005 1978 6457 8413 26");
  });

  it("kucuk harfli girdiyi kabul eder", () => {
    expect(isValidTrIban("tr330006100519786457841326")).toBe(true);
  });
});
