import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * TAM `User` SATIRI CEKEN ILISKI ICLERMELERI — mandal.
 *
 * NEDEN VAR (2026-08-31'de olculdu): Prisma'da `include: { guest: true }` o
 * iliskinin BUTUN sutunlarini getirir. `User` icin bu iki sey demek:
 *
 *   1. **`image` bir base64 data URL.** Avatar yukleme ucu 2 MB'a kadar dosya
 *      kabul edip `data:image/...;base64,...` olarak bu sutuna yaziyor --
 *      base64 sismesiyle ~2,7 MB. Bir LISTE sorgusunda (esnaf rezervasyonlari,
 *      sayfa basina 50 kayit) bu, hicbir ekranin okumadigi on megabaytlarca
 *      metnin Postgres'ten cekilmesi demek.
 *   2. **`passwordHash` sunucu bileseninin bellegine girer.** Bugun hicbir sey
 *      onu istemciye gecirmiyor -- sayfalar alanlari tek tek yaziyor -- ama
 *      React Server Component'te bir gun biri nesneyi oldugu gibi bir istemci
 *      bilesenine verirse bcrypt hash'i RSC yuku icinde tarayiciya gider. Alan
 *      listesi yazmak bu ihtimali bastan siler.
 *
 * Ayni sinif hata mobil tarafta `requireMobileUser`da vardi ve duzeltildi;
 * web tarafinda dort yerdeydi (esnaf rezervasyon listesi ve detayi, esnaf on
 * izleme action'inin iki sorgusu).
 *
 * TAVAN, YASAK DEGIL: kalanlar `src/services/` icindeki TIPLENMIS sorgular
 * (`BookingWithShopGuestDetails` gibi) ve onlari daraltmak cagiran tarafi da
 * degistirmeyi gerektiriyor. Sayi DUSER, yukselmez -- yeni bir `guest: true`
 * eklemek icin once mevcut bir tanesini daraltmak gerekir.
 */

const ROOT = path.resolve(__dirname, "../..");

/** `include: { guest: true }` bicimindeki tam-iliski secimleri. */
const FULL_RELATION_RE =
  /\b(guest|owner|user|requestedByUser|targetUser):\s*true\b/g;

/**
 * Yorumlar ayiklanir: bu dosyalarin cogunda "eskiden burada `guest: true`
 * vardi" gibi ACIKLAMALAR var ve onlar kod degil. (`service-layer-writes`
 * mandali ayni tuzaga bir kez dusmustu.)
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "__tests__") continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

/** OLCULEN tavan (2026-08-31). Yalnizca DUSER. */
const TOTAL_CEILING = 12;

/**
 * Kullanicinin GORDUGU yollar: burada tam satir cekmek en pahalisi, cunku
 * liste sorgulari ve sayfa cizimleri bu katmanda. Kesin 0.
 */
const CARRIER_DIRS = ["src/app/[locale]", "src/actions"];

describe("iliski iclermeleri tam `User` satiri cekmiyor", () => {
  it("tasiyici katmanda (sayfalar ve action'lar) tam satir cekilmiyor", () => {
    const offenders: string[] = [];
    for (const dir of CARRIER_DIRS) {
      for (const file of walk(path.join(ROOT, dir))) {
        const src = stripComments(fs.readFileSync(file, "utf8"));
        const hits = [...src.matchAll(FULL_RELATION_RE)];
        for (const h of hits) {
          offenders.push(`${path.relative(ROOT, file)}: ${h[0]}`);
        }
      }
    }
    expect(
      offenders,
      "Sayfa ve action katmaninda tam iliski secimi. `User.image` bir base64 " +
        "data URL (MB'lar) ve `passwordHash` da geliyor; ikisini de hicbir " +
        "ekran okumuyor. Alan listesi yazin:\n" + offenders.join("\n"),
    ).toEqual([]);
  });

  it("toplam sayi tavani asmiyor", () => {
    let total = 0;
    const detail: string[] = [];
    for (const file of walk(path.join(ROOT, "src"))) {
      const src = stripComments(fs.readFileSync(file, "utf8"));
      const n = [...src.matchAll(FULL_RELATION_RE)].length;
      if (n > 0) {
        total += n;
        detail.push(`${path.relative(ROOT, file)}: ${n}`);
      }
    }
    expect(
      total,
      `Tam iliski secimi: ${total} (tavan ${TOTAL_CEILING}). Bu sayi yalnizca ` +
        `DUSER; tavani yukseltmek sorunu cozmez, saklar.\n` + detail.join("\n"),
    ).toBeLessThanOrEqual(TOTAL_CEILING);
  });
});
