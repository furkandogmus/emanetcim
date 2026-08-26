import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { parseDatetimeLocalInTimeZone } from "@/lib/datetime-local";
import { isShopOpenAt } from "@/lib/shop-hours";

/**
 * P0: slot ÜRETİMİ dükkanın saat dilimini kullanmıyordu.
 *
 * `generateSlotsForShop` duvar saatini şöyle ana çeviriyordu:
 *
 *     const localIso = `${localDay}T${h}:${m}:00`;
 *     const startUtc = new Date(localIso);   // yorum: "parse as UTC"
 *
 * Yorum da kod da yanlıştı: saat dilimi eki OLMAYAN bir ISO tarih-saat dizesi
 * çalışma ortamının YEREL saatine göre ayrıştırılır. Konteynerde TZ ayarlı
 * olmadığı için prod UTC; geliştirici makinesi ise İstanbul saatinde. Yani hata
 * yalnızca PROD'da görünüyordu.
 *
 * Sonucu üç yerde birden ısırıyordu:
 *   - dükkan AÇIKKEN (09:00–12:00) hiç slot yok → arama o pencerede dükkanı eliyor
 *   - dükkan KAPALIYKEN (20:00–23:00) slot var → misafir rezervasyon yapıyor,
 *     geliyor ve `isShopOpenAt` check-in'i reddediyor
 *   - `shopTimeZone()` yardımcısı tanımlıydı ama HİÇ ÇAĞRILMIYORDU
 */

const IST = "Europe/Istanbul";

describe("slot üretimi saat dilimi", () => {
  it("eki olmayan ISO dizesi UTC DEĞİL, ortamın yerel saatidir", () => {
    // Hatanın kökü. `new Date` ortama göre değişir; bu fonksiyon değişmez.
    const asZoned = parseDatetimeLocalInTimeZone("2026-06-15T09:00:00", IST);
    expect(asZoned).not.toBeNull();
    // Istanbul yazin UTC+3 -> 09:00 yerel = 06:00Z
    expect(asZoned!.toISOString()).toBe("2026-06-15T06:00:00.000Z");
    // Prod'daki eski davranis (UTC konteyner) 09:00Z verirdi: 3 saat kayma.
    expect(asZoned!.toISOString()).not.toBe("2026-06-15T09:00:00.000Z");
  });

  it("kışın ofis değişir; dönüşüm DST'yi takip eder", () => {
    // Istanbul kalici UTC+3 kullaniyor; ofset degismedigi DOGRULANIYOR.
    const winter = parseDatetimeLocalInTimeZone("2026-01-15T09:00:00", IST);
    expect(winter!.toISOString()).toBe("2026-01-15T06:00:00.000Z");
    // DST uygulayan bir bolgede ayni duvar saati farkli ana duser.
    const berlinSummer = parseDatetimeLocalInTimeZone("2026-06-15T09:00:00", "Europe/Berlin");
    const berlinWinter = parseDatetimeLocalInTimeZone("2026-01-15T09:00:00", "Europe/Berlin");
    expect(berlinSummer!.toISOString()).toBe("2026-06-15T07:00:00.000Z");
    expect(berlinWinter!.toISOString()).toBe("2026-01-15T08:00:00.000Z");
  });

  it("üretilen slotlar dükkanın AÇIK olduğu saatlere düşer", () => {
    // 09:00-20:00 acik bir dukkan icin gun boyu 30 dakikalik slotlar.
    const open = "09:00";
    const close = "20:00";
    const starts: Date[] = [];
    for (let i = 0; i < 22; i++) {
      const mins = 9 * 60 + i * 30;
      const h = String(Math.floor(mins / 60) % 24).padStart(2, "0");
      const m = String(mins % 60).padStart(2, "0");
      starts.push(parseDatetimeLocalInTimeZone(`2026-06-15T${h}:${m}:00`, IST)!);
    }

    // Hepsi acik saat araliginda olmali — eski kodda son 6 slot KAPALI saatteydi.
    for (const s of starts) {
      expect(isShopOpenAt(open, close, s, IST), s.toISOString()).toBe(true);
    }

    // Ilk slot dukkanin acilisiyla ayni an.
    expect(starts[0].toISOString()).toBe("2026-06-15T06:00:00.000Z");
  });

  it("eski davranış check-in'i reddettirirdi — regresyon kanıtı", () => {
    // Eski kod (UTC konteyner) 19:30 duvar saatini 19:30Z olarak yaziyordu.
    const oldBuggy = new Date("2026-06-15T19:30:00Z"); // = Istanbul 22:30
    expect(isShopOpenAt("09:00", "20:00", oldBuggy, IST)).toBe(false);

    // Duzeltilmis: 19:30 Istanbul = 16:30Z, dukkan acik.
    const fixed = parseDatetimeLocalInTimeZone("2026-06-15T19:30:00", IST)!;
    expect(isShopOpenAt("09:00", "20:00", fixed, IST)).toBe(true);
  });

  it("üretim kodu ham `new Date(localIso)` kullanmıyor", () => {
    const src = fs
      .readFileSync("src/services/SlotService.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).toMatch(/parseDatetimeLocalInTimeZone\(localIso, tz\)/);
    expect(src).not.toMatch(/new Date\(localIso\)/);
  });
});
