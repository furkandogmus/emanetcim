import { describe, it, expect } from "vitest";
import {
  parseDatetimeLocalInTimeZone,
  toDatetimeLocalValueInTimeZone,
  PLATFORM_TIMEZONE,
} from "@/lib/datetime-local";

/**
 * Rezervasyon saatlerinin saat dilimi.
 *
 * BULUNAN HATA (2026-08-22): ana sayfa varsayılanları İSTANBUL saatinde
 * üretiliyordu (`toDatetimeLocalValueInTimeZone`) ama checkout onları `new Date()`
 * ile, yani **CİHAZIN** saat diliminde ayrıştırıyordu. İkisi ayrışıyordu:
 *
 *   Gösterilen (İstanbul): 2026-08-22T14:00
 *   Cihaz Berlin ise giden: 12:00Z  (İstanbul 15:00)
 *   Olması gereken        : 11:00Z  (İstanbul 14:00)
 *
 * Berlin'de 1 saat, New York'ta 7 saat kayma. Hedef kitle turist olduğu için asıl
 * senaryo: Alman bir misafir SEYAHATTEN ÖNCE evinden "14:00" seçiyor, dükkana
 * 15:00 bildiriliyor, misafir 14:00'te geliyor.
 *
 * Doğru model: rezervasyon saatleri DÜKKANIN yerel saatidir.
 */

describe("parseDatetimeLocalInTimeZone", () => {
  it("duvar saatini İstanbul saati olarak yorumlar", () => {
    const d = parseDatetimeLocalInTimeZone("2026-08-22T14:00", "Europe/Istanbul");
    // Istanbul yaz/kis fark etmeksizin UTC+3.
    expect(d?.toISOString()).toBe("2026-08-22T11:00:00.000Z");
  });

  it("SONUÇ CİHAZIN SAAT DİLİMİNDEN BAĞIMSIZ — hatanın özü buydu", () => {
    // Ayni girdi, ayni cikti olmali. Eski `new Date(value)` bunu saglamiyordu.
    const value = "2026-08-22T14:00";
    const expected = "2026-08-22T11:00:00.000Z";

    const original = process.env.TZ;
    for (const tz of ["Europe/Berlin", "America/New_York", "Asia/Tokyo", "UTC"]) {
      process.env.TZ = tz;
      expect(
        parseDatetimeLocalInTimeZone(value, "Europe/Istanbul")?.toISOString(),
        `cihaz ${tz} iken`,
      ).toBe(expected);
    }
    process.env.TZ = original;
  });

  it("gidiş-dönüş kayıpsız: üret → ayrıştır → aynı an", () => {
    const instant = new Date("2026-08-22T11:00:00.000Z");
    const wall = toDatetimeLocalValueInTimeZone(instant, PLATFORM_TIMEZONE);
    const back = parseDatetimeLocalInTimeZone(wall, PLATFORM_TIMEZONE);
    expect(back?.toISOString()).toBe(instant.toISOString());
  });

  it("farklı dükkan saat dilimlerini destekler", () => {
    // Sema Shop.timezone tutuyor; ileride Istanbul disi sehir eklenirse calismali.
    const berlin = parseDatetimeLocalInTimeZone("2026-08-22T14:00", "Europe/Berlin");
    expect(berlin?.toISOString()).toBe("2026-08-22T12:00:00.000Z"); // yazin UTC+2
  });

  describe("DST sınırları", () => {
    it("saat İLERİ alındığında doğru an üretir (Berlin, 29 Mart 2026)", () => {
      // 02:00 -> 03:00. 01:30 hala UTC+1.
      const before = parseDatetimeLocalInTimeZone("2026-03-29T01:30", "Europe/Berlin");
      expect(before?.toISOString()).toBe("2026-03-29T00:30:00.000Z");
      // 04:00 artik UTC+2.
      const after = parseDatetimeLocalInTimeZone("2026-03-29T04:00", "Europe/Berlin");
      expect(after?.toISOString()).toBe("2026-03-29T02:00:00.000Z");
    });

    it("saat GERİ alındığında çökmez (Berlin, 25 Ekim 2026)", () => {
      const d = parseDatetimeLocalInTimeZone("2026-10-25T02:30", "Europe/Berlin");
      expect(d).toBeInstanceOf(Date);
      expect(Number.isNaN(d!.getTime())).toBe(false);
    });

    it("Türkiye'de DST yok — yaz ve kış aynı ofset", () => {
      const summer = parseDatetimeLocalInTimeZone("2026-07-15T12:00", "Europe/Istanbul");
      const winter = parseDatetimeLocalInTimeZone("2026-01-15T12:00", "Europe/Istanbul");
      expect(summer?.toISOString()).toBe("2026-07-15T09:00:00.000Z");
      expect(winter?.toISOString()).toBe("2026-01-15T09:00:00.000Z");
    });
  });

  describe("bozuk girdi", () => {
    it.each(["", "   ", "abc", "2026-13-45T99:99"])("%s → null", (v) => {
      expect(parseDatetimeLocalInTimeZone(v)).toBeNull();
    });

    it("saniyeli biçimi de kabul eder", () => {
      const d = parseDatetimeLocalInTimeZone("2026-08-22T14:00:00", "Europe/Istanbul");
      expect(d?.toISOString()).toBe("2026-08-22T11:00:00.000Z");
    });
  });
});
