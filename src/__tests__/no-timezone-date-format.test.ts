import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/strip-comments";

/**
 * `timeZone`SUZ TARİH BİÇİMLENDİRMESİ — TÜM `src` (mandal).
 *
 * NEDEN (2026-11-22, web kalite taraması): `server-timezone-format.test.ts`
 * yalnızca sunucu dosyalarını ve misafir bileşenlerini tarıyordu. Admin ve esnaf
 * panellerinde ~20 çağrı `new Date(iso).toLocaleString(dateLocale, {...})`
 * yazıyordu, `timeZone` yoktu. Bu bileşenler de SSR ile çiziliyor: sunucu
 * (konteyner UTC) "10:00", tarayıcı "13:00" basıyor, React hydration
 * uyuşmazlığı veriyordu. Yurt dışından bakan esnaf ise rezervasyon saatini
 * dükkanın değil KENDİ cihazının saatinde görüyordu.
 *
 * Kural: tarih biçimlendiren her çağrı (`toLocaleDateString`,
 * `toLocaleTimeString`, tarih seçenekli `toLocaleString`,
 * `new Intl.DateTimeFormat`) çağrı penceresinde `timeZone` taşır. Kolay yol
 * `formatInstant` (`src/lib/format-datetime.ts`).
 *
 * İSTİSNALAR açıkça sayılıyor, sayı tavanı değil: her biri bir gerekçe taşır
 * ve sayısı yalnızca düşebilir.
 */

/**
 * Dilimsiz biçimlendirmenin DOĞRU olduğu yerler.
 *
 * `DateTimePicker`: biçimlendirdiği değer bir AN değil, `datetime-local`
 * DUVAR SAATİ. `parseDatetimeLocal` onu cihaz diliminde kurar, aynı dilimde
 * geri yazmak girilen metni aynen gösterir (sunucuda da, tarayıcıda da
 * "14:00" → "14:00"). Dilim eklemek tam tersine saati kaydırır. Ay başlığı da
 * `react-day-picker`ın yerel gece yarısı tarihinden geliyor.
 */
const JUSTIFIED: Record<string, number> = {
  "src/components/ui/DateTimePicker.tsx": 2,
};

/** Pencere: çok satırlı seçenek nesneleri aşağı dağılır. */
const WINDOW_LINES = 8;

/** `toLocaleString` sayılarda da kullanılır; tarih olduğu bu ipuçlarından anlaşılır. */
const DATE_OPTION_HINT =
  /\b(dateStyle|timeStyle|weekday|era|year|month|day|hour|minute|second)\s*:/;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "node_modules" || name === "__tests__") continue;
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

/** Bir kaynak metindeki dilimsiz tarih biçimlendirmelerinin satır numaraları. */
export function findUnzonedDateFormats(src: string): number[] {
  const lines = stripComments(src).split("\n");
  const hits: number[] = [];
  lines.forEach((line, i) => {
    const window = lines.slice(i, i + WINDOW_LINES).join("\n");
    const isDateCall =
      /\.toLocale(Date|Time)String\s*\(/.test(line) ||
      /new\s+Intl\.DateTimeFormat\s*\(/.test(line) ||
      (/\.toLocaleString\s*\(/.test(line) &&
        (/new Date\([^)]*\)\.toLocaleString/.test(line) ||
          DATE_OPTION_HINT.test(window.slice(window.indexOf("toLocaleString")))));
    if (!isDateCall) return;
    if (/\btimeZone\b/.test(window)) return;
    hits.push(i + 1);
  });
  return hits;
}

function scan(): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const file of sourceFiles(join(process.cwd(), "src"))) {
    const hits = findUnzonedDateFormats(readFileSync(file, "utf-8"));
    if (hits.length) out[file.replace(process.cwd() + "/", "")] = hits;
  }
  return out;
}

describe("src altında timeZone'suz tarih biçimlendirmesi yok (mandal)", () => {
  const found = scan();

  it("istisna listesi dışında ihlal yok", () => {
    const offenders = Object.entries(found)
      .filter(([file]) => !(file in JUSTIFIED))
      .map(([file, lines]) => `${file}:${lines.join(",")}`);
    expect(
      offenders,
      `timeZone'suz tarih biçimlendirmesi -- \`formatInstant\` kullanın:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("istisnalar tavanını aşmıyor (düşerse listeyi de düşürün)", () => {
    for (const [file, ceiling] of Object.entries(JUSTIFIED)) {
      expect(found[file]?.length ?? 0, file).toBeLessThanOrEqual(ceiling);
    }
  });
});

describe("findUnzonedDateFormats kalıbı", () => {
  it("dilimsiz toLocaleString(tarih seçenekli) yakalanır", () => {
    const src = `const a = new Date(iso).toLocaleString(locale, {\n  day: "2-digit",\n  hour: "2-digit",\n});`;
    expect(findUnzonedDateFormats(src)).toEqual([1]);
  });

  it("dilimsiz toLocaleDateString ve Intl.DateTimeFormat yakalanır", () => {
    expect(findUnzonedDateFormats(`d.toLocaleDateString("tr-TR")`)).toEqual([1]);
    expect(findUnzonedDateFormats(`new Intl.DateTimeFormat(l, { month: "long" })`)).toEqual([1]);
  });

  it("timeZone taşıyan çağrı ve sayı biçimlendirmesi geçer", () => {
    expect(findUnzonedDateFormats(`d.toLocaleDateString("en-CA", { timeZone })`)).toEqual([]);
    expect(findUnzonedDateFormats(`n.toLocaleString(locale, { maximumFractionDigits: 2 })`)).toEqual([]);
    expect(findUnzonedDateFormats(`count.toLocaleString(locale)`)).toEqual([]);
  });

  it("yorumdaki örnek ihlal sayılmaz", () => {
    expect(findUnzonedDateFormats(`// d.toLocaleString("tr-TR", { hour: "2-digit" })`)).toEqual([]);
  });
});
