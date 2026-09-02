import { describe, it, expect } from "vitest";
import { slotCalendarDays } from "@/lib/slot-calendar";

/**
 * SLOT PENCERESI TAKVIM GUNU SAYAR, 24 SAAT DEGIL.
 *
 * Olculdu (2026-09-02): sayac `dayStart.setDate(dayStart.getDate() + n)` ile
 * yuruyordu -- `now`a 24 saat ekleyip sonucu dukkanin diliminde bicimliyordu.
 * 24 saat bir takvim gunu DEGILDIR: yaz saati bitisinde gun 25 saat surer ve
 * ayni yerel gun iki kez cikar, penceredeki son gun hic uretilmez.
 *
 *     Europe/Amsterdam, 2026-10-24T22:30Z (dukkanda 00:30):
 *       eski: 2026-10-25  2026-10-25  2026-10-26  2026-10-27
 *
 * Zarar cift slot DEGIL (`@@unique([shopId, startTime])` + `upsert` onu
 * yutuyor); zarar 30 gunluk pencerenin 29 gun uretmesi ve otuzuncu gunun
 * aramada hic gorunmemesi.
 *
 * Test hem eski davranisi (kirmizi olmali) hem yenisini olcer: asagidaki
 * `eskiDavranis` bilerek duruyor, cunku bir mandalin degeri, KORUDUGU HATAYI
 * uretebiliyor olmasindadir.
 */

/** Duzeltilen hatanin ta kendisi -- karsilastirma icin. */
function eskiDavranis(now: Date, timeZone: string, daysForward: number): string[] {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const out: string[] = [];
  for (let d = 0; d < daysForward; d++) {
    const ds = new Date(now);
    ds.setDate(ds.getDate() + d);
    out.push(fmt.format(ds));
  }
  return out;
}

const DST_SENARYOLARI: Array<{ tz: string; now: string; not: string }> = [
  {
    tz: "Europe/Amsterdam",
    now: "2026-10-24T22:30:00Z",
    not: "yaz saati bitisi (25 Ekim), dukkanda 00:30",
  },
  {
    tz: "America/Los_Angeles",
    now: "2026-11-01T07:30:00Z",
    not: "yaz saati bitisi (1 Kasim), dukkanda 00:30",
  },
];

describe("slot takvim gunleri", () => {
  it.each(DST_SENARYOLARI)("$tz -- $not: gun TEKRARLAMIYOR", ({ tz, now }) => {
    const gunler = slotCalendarDays(new Date(now), tz, 4);
    expect(new Set(gunler).size, gunler.join(" ")).toBe(gunler.length);
  });

  it.each(DST_SENARYOLARI)("$tz -- $not: eski davranis GERCEKTEN bozuktu", ({ tz, now }) => {
    // Mandal, korudugu hatayi uretebilmeli; yoksa neyi korudugu belirsizdir.
    const eski = eskiDavranis(new Date(now), tz, 4);
    expect(new Set(eski).size, eski.join(" ")).toBeLessThan(eski.length);
  });

  it("istenen gun sayisi kadar gun dondurur", () => {
    for (const gunSayisi of [1, 7, 30]) {
      expect(slotCalendarDays(new Date("2026-10-24T22:30:00Z"), "Europe/Amsterdam", gunSayisi))
        .toHaveLength(gunSayisi);
    }
  });

  it("ilk gun DUKKANIN bugunu", () => {
    // Cron 04:17 UTC kosuyor; UTC'nin gerisindeki dilimde o an henuz onceki gun.
    const now = new Date("2026-10-22T04:17:00Z");
    const [ilk] = slotCalendarDays(now, "America/Los_Angeles", 3);
    const dukkandaBugun = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    expect(ilk).toBe(dukkandaBugun);
  });

  it("gunler ardisik ve artan", () => {
    const gunler = slotCalendarDays(new Date("2026-03-28T23:30:00Z"), "Europe/Amsterdam", 5);
    for (let i = 1; i < gunler.length; i++) {
      const fark =
        (Date.parse(gunler[i]) - Date.parse(gunler[i - 1])) / 86_400_000;
      expect(fark, `${gunler[i - 1]} -> ${gunler[i]}`).toBe(1);
    }
  });

  it("yil sinirini gecer", () => {
    const gunler = slotCalendarDays(new Date("2026-12-30T12:00:00Z"), "Europe/Istanbul", 4);
    expect(gunler).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  });
});
