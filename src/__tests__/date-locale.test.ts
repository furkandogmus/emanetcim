import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { dateLocaleForUiLocale } from "@/lib/date-locale";

/**
 * Tarih ve sayı biçimlendirmesi.
 *
 * İki ayrı hata bulundu (2026-08-22):
 *
 * 1. `dateLocaleForUiLocale` 14 dilin yalnızca 7'sini eşliyordu; kalan 6'sı
 *    (`de`, `fr`, `es`, `it`, `zh`, `ja`) sessizce **`en-US`'e** düşüyordu.
 *    Alman bir kullanıcı `8/22/2026` görüyordu, oysa `22.8.2026` olmalı.
 *    `8/22` ile `22/8` arasındaki fark, yılın hangi günü bavul bırakılacağıdır —
 *    turist odaklı bir üründe bu ciddi bir yanlış okumadır.
 *
 * 2. Dokuz yerde `toLocaleDateString()` / `toLocaleString()` **locale argümanı
 *    olmadan** çağrılıyordu. İstemcide bu tarayıcının diline, sunucuda ise
 *    **makinenin ICU varsayılanına** düşer — yani sonuç ortama göre değişir ve
 *    hydration uyuşmazlığı bile üretebilir.
 */

/** `src/i18n` yapılandırmasındaki desteklenen diller. */
const SUPPORTED = [
  "tr", "en", "de", "fr", "es", "it", "ru",
  "ar", "fa", "zh", "ja", "ko", "pl", "bg",
];

describe("dateLocaleForUiLocale", () => {
  it("desteklenen HİÇBİR dil sessizce en-US'e düşmüyor", () => {
    const fallenBack = SUPPORTED.filter(
      (l) => l !== "en" && dateLocaleForUiLocale(l) === "en-US",
    );
    expect(
      fallenBack,
      `Bu diller Amerikan tarih formatına düşüyor: ${fallenBack.join(", ")}`,
    ).toEqual([]);
  });

  it("her dil kendi dilinde bir etiket döndürür", () => {
    for (const l of SUPPORTED) {
      expect(dateLocaleForUiLocale(l).startsWith(l), `${l}`).toBe(true);
    }
  });

  it("gerçekten farklı tarih biçimleri üretir", () => {
    const d = new Date("2026-08-22T12:00:00Z");
    const fmt = (l: string) =>
      d.toLocaleDateString(dateLocaleForUiLocale(l), { timeZone: "UTC" });

    // Gun/ay sirasi dillere gore GERCEKTEN degismeli.
    expect(fmt("de")).not.toBe(fmt("en"));
    expect(fmt("ja")).not.toBe(fmt("en"));
    expect(fmt("fr")).not.toBe(fmt("en"));
  });

  it("bilinmeyen dil en-US'e değil, DİLİN KENDİSİNE düşer", () => {
    // Sessizce Amerikan formatina dusmek yerine en azindan dogru dilde kalmali.
    expect(dateLocaleForUiLocale("nl")).toBe("nl");
  });

  it("boş girdide çökmez", () => {
    expect(dateLocaleForUiLocale("")).toBe("en-US");
  });
});

describe("locale'siz biçimlendirme kalmadı — mandal", () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (e.name.endsWith(".tsx")) out.push(p);
    }
    return out;
  }

  it("`toLocaleDateString()` / `toLocaleString()` argümansız çağrılmıyor", () => {
    const offenders: string[] = [];
    for (const root of ["src/components", "src/app"]) {
      const abs = path.join(process.cwd(), root);
      if (!fs.existsSync(abs)) continue;
      for (const file of walk(abs)) {
        const src = fs
          .readFileSync(file, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "");
        if (/\.toLocale(Date|Time)?String\(\s*\)/.test(src)) {
          offenders.push(path.relative(process.cwd(), file));
        }
      }
    }
    expect(
      offenders,
      `Bu dosyalar locale ARGÜMANI OLMADAN biçimlendiriyor; sonuç ortama göre ` +
        `değişir. \`dateLocaleForUiLocale(locale)\` geçin:\n` +
        offenders.map((o) => `  ${o}`).join("\n"),
    ).toEqual([]);
  });
});
