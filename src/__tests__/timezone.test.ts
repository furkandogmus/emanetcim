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
