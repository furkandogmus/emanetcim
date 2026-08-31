import { describe, it, expect } from "vitest";
import { startOfDayInTimeZone } from "@/lib/timezone";

/**
 * "Bugünkü kazanç" sınırı. Eski hâli `today.setHours(0,0,0,0)` idi ve SUNUCUNUN
 * saat dilimini okuyordu; UTC çalışan üretim konteynerinde İstanbul'daki esnaf
 * için "bugün" 03:00'te başlıyordu.
 */
describe("dükkan saat diliminde günün başlangıcı", () => {
  it("İstanbul'da gece yarısı, UTC'de bir önceki gün 21:00'dir", () => {
    // 2026-08-31 10:00 UTC = Istanbul'da 13:00, yani gunun basi 2026-08-31 00:00 IST
    // = 2026-08-30 21:00 UTC (UTC+3).
    const start = startOfDayInTimeZone("Europe/Istanbul", new Date("2026-08-31T10:00:00Z"));
    expect(start.toISOString()).toBe("2026-08-30T21:00:00.000Z");
  });

  it("UTC'de gece yarısından HEMEN SONRA bakan esnaf hâlâ dünün gününü görür", () => {
    /*
      Asil kusur buydu. 2026-08-31 00:30 UTC, Istanbul'da 03:30 -- yani gun coktan
      donmus. Eski kod (sunucu UTC) gunun basini 2026-08-31 00:00 UTC saydigi icin
      Istanbul'un 00:00-03:00 arasindaki rezervasyonlarini "bugun"den DUSURUYORDU.
    */
    const start = startOfDayInTimeZone("Europe/Istanbul", new Date("2026-08-31T00:30:00Z"));
    expect(start.toISOString()).toBe("2026-08-30T21:00:00.000Z");
    // Istanbul'da 01:00'de yapilan bir rezervasyon "bugun"e DAHIL olmali.
    expect(new Date("2026-08-30T22:00:00Z") >= start).toBe(true);
  });

  it("farklı saat dilimlerinde farklı sınır üretir", () => {
    const at = new Date("2026-08-31T10:00:00Z");
    const ist = startOfDayInTimeZone("Europe/Istanbul", at);
    const tokyo = startOfDayInTimeZone("Asia/Tokyo", at);
    const utc = startOfDayInTimeZone("UTC", at);
    expect(utc.toISOString()).toBe("2026-08-31T00:00:00.000Z");
    expect(tokyo.toISOString()).toBe("2026-08-30T15:00:00.000Z");
    expect(ist.getTime()).not.toBe(tokyo.getTime());
  });

  it("kış saatinde farkın değiştiği bir dilimde de doğru", () => {
    // New York: yazin UTC-4, kisin UTC-5. Sabit fark varsayan kod birini kacirir.
    const summer = startOfDayInTimeZone("America/New_York", new Date("2026-07-15T12:00:00Z"));
    const winter = startOfDayInTimeZone("America/New_York", new Date("2026-01-15T12:00:00Z"));
    expect(summer.toISOString()).toBe("2026-07-15T04:00:00.000Z");
    expect(winter.toISOString()).toBe("2026-01-15T05:00:00.000Z");
  });
});

import { dayRangeInTimeZone, monthRangeInTimeZone } from "@/lib/timezone";

describe("gün aralığı", () => {
  it("yarı açık aralık üretir ve gün 24 saattir", () => {
    const { start, end } = dayRangeInTimeZone("Europe/Istanbul", new Date("2026-08-31T10:00:00Z"));
    expect(start.toISOString()).toBe("2026-08-30T21:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-31T21:00:00.000Z");
  });

  it("yaz saati BİTİŞİNDE gün 25 saattir — sabit +24 saat yanlış olurdu", () => {
    /*
      Avrupa'da 2026-10-25'te saatler geri aliniyor. O gun 25 saat surer; sinir
      "baslangic + 24 saat" ile hesaplansaydi gunun son saati aralik DISINDA
      kalir ve o saatteki rezervasyon hicbir gune dusmezdi.
    */
    const { start, end } = dayRangeInTimeZone("Europe/Berlin", new Date("2026-10-25T10:00:00Z"));
    const hours = (end.getTime() - start.getTime()) / 3_600_000;
    expect(hours).toBe(25);
  });

  it("yaz saati BAŞLANGICINDA gün 23 saattir", () => {
    const { start, end } = dayRangeInTimeZone("Europe/Berlin", new Date("2026-03-29T10:00:00Z"));
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(23);
  });
});

describe("ay aralığı", () => {
  it("içinde bulunulan ayın sınırlarını verir", () => {
    const { start, end } = monthRangeInTimeZone("Europe/Istanbul", new Date("2026-08-31T10:00:00Z"));
    // Agustos 1, 00:00 IST = 31 Temmuz 21:00 UTC
    expect(start.toISOString()).toBe("2026-07-31T21:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-31T21:00:00.000Z");
  });

  it("geçen aya gidebilir ve yıl sınırını geçebilir", () => {
    const prev = monthRangeInTimeZone("Europe/Istanbul", new Date("2026-01-15T10:00:00Z"), 1);
    // Aralik 2025. Turkiye 2016'dan beri KALICI UTC+3 -- kis saati yok, yani
    // Aralik da Agustos gibi +3. 1 Aralik 00:00 IST = 30 Kasim 21:00 UTC.
    expect(prev.start.toISOString()).toBe("2025-11-30T21:00:00.000Z");
    expect(prev.end.toISOString()).toBe("2025-12-31T21:00:00.000Z");
  });

  it("ayın son gününde bakıldığında da doğru ayı seçer", () => {
    // Ayin 31'inde `setMonth(-1)` tipi hesaplar bir onceki ayi atlar (31 Mart -> 3 Mart).
    const { start } = monthRangeInTimeZone("Europe/Istanbul", new Date("2026-03-31T20:00:00Z"), 1);
    expect(start.toISOString().slice(0, 7)).toBe("2026-01"); // Subat 1 00:00 IST = 31 Ocak 21:00 UTC
  });
});
