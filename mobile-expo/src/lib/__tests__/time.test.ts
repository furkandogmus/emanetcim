import { describe, expect, it } from "@jest/globals";

import { atWallMinutes, cellOf, fromCell, sameWallDay, wallInstant, wallMinutes, wallParts } from "@/lib/time";

/**
 * Duvar saati telefonun değil İstanbul'un (UTC+3). Kural kırılırsa Londra'daki
 * bir telefonla 18:00 seçen misafir 20:00 TRT'ye rezervasyon yapar (time.ts).
 * Testler telefonun saat diliminden bağımsız yazıldı: anlar UTC ile kuruluyor.
 */
describe("wallParts", () => {
  it("UTC anı İstanbul saatine kaydırır", () => {
    const p = wallParts(new Date("2026-10-18T15:00:00Z"));
    expect(p).toMatchObject({ year: 2026, month: 9, day: 18, hour: 18, minute: 0 });
  });

  it("UTC'de gün bitmeden İstanbul'da ertesi güne geçer", () => {
    // 22:30 UTC = 01:30 TRT, ertesi gün; pazar → pazartesi.
    const p = wallParts("2026-10-18T22:30:00Z");
    expect(p).toMatchObject({ day: 19, hour: 1, minute: 30, weekday: 1 });
  });
});

describe("wallInstant", () => {
  it("İstanbul 18:00, 15:00 UTC'dir", () => {
    expect(wallInstant(2026, 9, 18, 18, 0).toISOString()).toBe("2026-10-18T15:00:00.000Z");
  });

  it("taşan gün normalize olur (31 Ekim + 1)", () => {
    expect(wallInstant(2026, 9, 32, 9, 0).toISOString()).toBe("2026-11-01T06:00:00.000Z");
  });

  it("wallParts ile gidiş-dönüş aynı anı verir", () => {
    const d = new Date("2026-03-29T07:45:00Z");
    const p = wallParts(d);
    expect(wallInstant(p.year, p.month, p.day, p.hour, p.minute).getTime()).toBe(d.getTime());
  });
});

describe("dakika ve gün yardımcıları", () => {
  it("wallMinutes İstanbul saatini dakika olarak verir", () => {
    expect(wallMinutes(new Date("2026-10-18T06:15:00Z"))).toBe(9 * 60 + 15);
  });

  it("atWallMinutes aynı İstanbul gününde saati değiştirir", () => {
    const d = new Date("2026-10-18T22:30:00Z"); // 19 Ekim 01:30 TRT
    expect(atWallMinutes(d, 20 * 60).toISOString()).toBe("2026-10-19T17:00:00.000Z");
  });

  it("sameWallDay UTC'de aynı gün olsa da İstanbul'da farklı günleri ayırır", () => {
    const a = new Date("2026-10-18T20:00:00Z"); // 18 Ekim 23:00 TRT
    const b = new Date("2026-10-18T21:30:00Z"); // 19 Ekim 00:30 TRT
    expect(sameWallDay(a, b)).toBe(false);
    expect(sameWallDay(a, new Date("2026-10-18T05:00:00Z"))).toBe(true);
  });
});

describe("takvim hücresi", () => {
  it("cellOf İstanbul gününü telefonun yerel gece yarısına koyar", () => {
    const cell = cellOf(new Date("2026-10-18T22:30:00Z")); // 19 Ekim TRT
    expect([cell.getFullYear(), cell.getMonth(), cell.getDate(), cell.getHours()]).toEqual([2026, 9, 19, 0]);
  });

  it("fromCell hücreyi İstanbul saatindeki ana çevirir", () => {
    const cell = new Date(2026, 9, 19);
    expect(fromCell(cell, 18 * 60 + 30).toISOString()).toBe("2026-10-19T15:30:00.000Z");
  });
});
