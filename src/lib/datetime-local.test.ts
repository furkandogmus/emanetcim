import { describe, it, expect } from "vitest";
import {
  toDatetimeLocalValueInTimeZone,
  defaultStayWindowLocalValues,
  parseDatetimeLocal,
  PLATFORM_TIMEZONE,
} from "./datetime-local";

/**
 * Bu fonksiyonun tek işi DETERMİNİSTİK olmak.
 *
 * `toDatetimeLocalValue(new Date())` sunucuda (konteyner UTC) ve istemcide
 * (ziyaretçinin saat dilimi) farklı metin üretiyordu; değer bir input'un
 * `value`'su olduğu için React hydration'da #418 metin uyuşmazlığı veriyor ve
 * ağacı istemcide baştan render ediyordu. Ana sayfada tam bu oluyordu.
 */

describe("toDatetimeLocalValueInTimeZone", () => {
  it("verilen saat dilimine göre çevirir (UTC girdi → Istanbul çıktı)", () => {
    // 2026-08-22T07:05:00Z, Istanbul'da (UTC+3) 10:05.
    const d = new Date("2026-08-22T07:05:00Z");
    expect(toDatetimeLocalValueInTimeZone(d, "Europe/Istanbul")).toBe(
      "2026-08-22T10:05",
    );
  });

  it("gün sınırını doğru aşar", () => {
    // 2026-08-22T22:30:00Z -> Istanbul'da ERTESI gun 01:30.
    const d = new Date("2026-08-22T22:30:00Z");
    expect(toDatetimeLocalValueInTimeZone(d, "Europe/Istanbul")).toBe(
      "2026-08-23T01:30",
    );
  });

  it("gece yarısını 24 değil 00 olarak yazar (input formatı gereği)", () => {
    // 2026-08-22T21:00:00Z -> Istanbul'da tam gece yarisi.
    const d = new Date("2026-08-22T21:00:00Z");
    const out = toDatetimeLocalValueInTimeZone(d, "Europe/Istanbul");
    expect(out).toBe("2026-08-23T00:00");
    expect(out).not.toContain("T24:");
  });

  it("aynı ana farklı saat dilimlerinde farklı sonuç verir", () => {
    const d = new Date("2026-08-22T07:05:00Z");
    expect(toDatetimeLocalValueInTimeZone(d, "UTC")).toBe("2026-08-22T07:05");
    expect(toDatetimeLocalValueInTimeZone(d, "Europe/Istanbul")).toBe(
      "2026-08-22T10:05",
    );
    expect(toDatetimeLocalValueInTimeZone(d, "Asia/Tokyo")).toBe(
      "2026-08-22T16:05",
    );
  });

  it("DETERMİNİSTİK: aynı girdi + aynı saat dilimi her zaman aynı çıktı", () => {
    // Hydration guvenligi tam olarak bu ozelliğe dayaniyor.
    const d = new Date("2026-12-31T21:45:00Z");
    const a = toDatetimeLocalValueInTimeZone(d, PLATFORM_TIMEZONE);
    const b = toDatetimeLocalValueInTimeZone(d, PLATFORM_TIMEZONE);
    expect(a).toBe(b);
  });

  it("saat dilimi verilmezse platform saat dilimini kullanır", () => {
    const d = new Date("2026-08-22T07:05:00Z");
    expect(toDatetimeLocalValueInTimeZone(d)).toBe(
      toDatetimeLocalValueInTimeZone(d, PLATFORM_TIMEZONE),
    );
  });

  it("çıktısı datetime-local biçimine uyar", () => {
    const d = new Date("2026-03-07T04:03:00Z");
    expect(toDatetimeLocalValueInTimeZone(d)).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
    );
  });

  it("ürettiği değer geri ayrıştırılabilir", () => {
    const v = toDatetimeLocalValueInTimeZone(new Date("2026-08-22T07:05:00Z"));
    expect(parseDatetimeLocal(v)).toBeInstanceOf(Date);
  });
});

describe("defaultStayWindowLocalValues", () => {
  it("alış, bırakıştan sonra gelir", () => {
    const { checkIn, checkOut } = defaultStayWindowLocalValues();
    expect(checkOut > checkIn).toBe(true);
  });

  it("iki değer de datetime-local biçiminde", () => {
    const { checkIn, checkOut } = defaultStayWindowLocalValues();
    for (const v of [checkIn, checkOut]) {
      expect(v).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    }
  });

  it("aralık yaklaşık 24 saat", () => {
    const { checkIn, checkOut } = defaultStayWindowLocalValues();
    const a = parseDatetimeLocal(checkIn)!;
    const b = parseDatetimeLocal(checkOut)!;
    const hours = (b.getTime() - a.getTime()) / 3_600_000;
    // Yaz saati gecisi olan gunlerde 23 veya 25 olabilir.
    expect(hours).toBeGreaterThanOrEqual(23);
    expect(hours).toBeLessThanOrEqual(25);
  });
});
