import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * TEMİNAT TUTARI HER DİLDE AYNI OLMALI.
 *
 * NEDEN VAR (2026-09-01'de ölçüldü): valiz başına güvence tutarının kod tabanında
 * TEK BİR KAYNAĞI YOK. `PlatformSettings` yalnızca `insuranceFeeTry`yi (alınan
 * ücret, üretimde 0) tutuyor; TEMİNAT rakamı altı çeviri dosyasına elle, toplam
 * 60 yere yazılmış.
 *
 * Tutar bir noktada 5.000'den 10.000'e çıkarılmış ve göç YARIM KALMIŞ:
 *
 *   tr / en / de / fr / ja : 10/10 yerde 10.000
 *   fa                     : 8 yerde 10.000, **2 yerde 5.000**
 *
 * İkisinden biri `Terms.a2` idi — yani KULLANIM ŞARTLARI'nın sorumluluk maddesi.
 * Farsça okuyan bir misafire hukuki belgede 5.000, SSS'te 10.000 yazıyordu.
 *
 * `locales.test.ts` bunu yakalayamaz: o, anahtarın VAR olup olmadığına bakar,
 * DEĞERİN tutarlılığına değil. Bu mandal o boşluğu kapatır.
 *
 * Rakamlar YEREL ALFABEDE yazılabilir (Farsça ۱۰٬۰۰۰ kullanıyor), o yüzden
 * karşılaştırma Unicode rakam değerine indirgenerek yapılır — ASCII taraması
 * bu hatayı ilk denemede GÖRMEDİ, `fa`yı "yalnızca 1 yerde geçiyor" sandı.
 */

const LOCALES_DIR = path.join(process.cwd(), "src/locales");

/**
 * Yerel alfabedeki rakamları ASCII'ye indirger (۵ -> 5, ٥ -> 5, ５ -> 5).
 *
 * `Number("۵")` JS'te **NaN** döner -- ilk denemede bu yüzden Farsça rakamlar
 * hiç dönüşmedi ve test `fa: (rakam yok)` diyerek hatayı YANLIŞ yerde gösterdi.
 * Dönüşüm blok başlangıcından çıkarılarak yapılıyor, ayrıştırmaya güvenilmiyor.
 */
const DIGIT_BLOCK_ZEROS = [
  0x0030, // ASCII 0-9
  0x0660, // Arap-Hint ٠-٩
  0x06f0, // Genişletilmiş Arap-Hint (Farsça) ۰-۹
  0xff10, // Tam genişlik ０-９
];

function toAsciiDigits(s: string): string {
  return s.replace(/\p{Nd}/gu, (c) => {
    const cp = c.codePointAt(0)!;
    for (const zero of DIGIT_BLOCK_ZEROS) {
      if (cp >= zero && cp <= zero + 9) return String(cp - zero);
    }
    return c;
  });
}

/** Binlik ayracı ne olursa olsun 4-6 haneli tutarları yakalar. */
const AMOUNT_RE = /(?<!\d)(\d{1,3})[.,٫٬’\s]?(\d{3})(?!\d)/g;

function amountsIn(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    // Yalnizca "sigorta/guvence" baglaminda gecen tutarlar; fiyat, mesafe vb. degil.
    const ascii = toAsciiDigits(value);
    for (const m of ascii.matchAll(AMOUNT_RE)) out.add(`${m[1]}${m[2]}`);
    return;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) amountsIn(v, out);
  }
}

/** Teminat rakamının geçtiği, HER DİLDE bulunan anahtarlar. */
const COVERAGE_KEYS = [
  ["Terms", "a2"],
  ["Guest", "insuranceIncluded"],
  ["Guest", "trustInsuranceBody"],
  ["FAQ", "a1"],
  ["FAQ", "a5"],
] as const;

function read(locale: string): Record<string, Record<string, string>> {
  return JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${locale}.json`), "utf8"));
}

const LOCALES = fs
  .readdirSync(LOCALES_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""));

describe("teminat tutarı bütün dillerde aynı", () => {
  it.each(COVERAGE_KEYS.map(([ns, key]) => [`${ns}.${key}`, ns, key] as const))(
    "%s her dilde AYNI tutarı söylüyor",
    (label, ns, key) => {
      const byLocale = new Map<string, string[]>();
      for (const locale of LOCALES) {
        const value = read(locale)[ns]?.[key];
        if (typeof value !== "string") continue;
        const found = new Set<string>();
        amountsIn(value, found);
        byLocale.set(locale, [...found].sort());
      }

      const distinct = new Set([...byLocale.values()].map((a) => a.join(",")));
      expect(
        distinct.size,
        `\`${label}\` dillere göre FARKLI tutar söylüyor. Teminat rakamının tek bir ` +
          `kaynağı yok; bir dil güncellenip diğeri unutulursa hukuki belge dile göre ` +
          `değişir.\n` +
          [...byLocale.entries()].map(([l, a]) => `  ${l}: ${a.join(", ") || "(rakam yok)"}`).join("\n"),
      ).toBe(1);
    },
  );
});
