import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";


/**
 * BİLDİRİM DİLİ MANDALI — hiçbir e-posta şablonu bir dili atlayamaz.
 *
 * NEDEN VAR: bu hata ÜÇ KEZ elle düzeltildi (`3a1c988`, `051e89e` ve 24 Ağustos
 * turu) ve her seferinde aynı yapıdan çıktı. `NotificationService` şablonları
 * şu kalıpta yazılıyor:
 *
 *     const content = { tr: {...}, en: {...} }[locale] ?? { ...Türkçe yedek };
 *
 * `??` operatörü eksik bir dili SESSİZCE yutar: Japon bir misafir, uygulamanın
 * geri kalanı tam çeviriliyken rezervasyon onayını (sakladığı belgeyi) Türkçe ve
 * HTML'siz alır. Ne tip kontrolü ne lint bunu görür — çünkü teknik olarak doğru
 * kod. Görülebilmesi için ÖLÇÜLMESİ gerekiyordu.
 *
 * Yeni bir dil eklendiğinde bu test 6 şablonun altısında da kırılır; eksik
 * çeviriyle dil eklenmesini engelleyen tek şey budur.
 */

/**
 * Desteklenen diller `src/i18n/routing.ts`'ten OKUNUR, import EDILMEZ: o modul
 * `createNavigation` uzerinden `next/navigation`'i cekiyor ve test ortaminda
 * cozulmuyor. Kaynak yine tek: liste orada tanimli.
 */
function supportedLocales(): string[] {
  const src = fs.readFileSync(path.join(process.cwd(), "src/i18n/routing.ts"), "utf8");
  const block = src.slice(src.indexOf("locales: ["), src.indexOf("]", src.indexOf("locales: [")));
  const found = [...block.matchAll(/'([a-z]{2})'/g)].map((m) => m[1]);
  if (found.length === 0) throw new Error("routing.ts icindeki dil listesi okunamadi");
  return found;
}

const LOCALES = supportedLocales();

/** `}` konumundan geriye giderek eşleşen `{`i bulur. */
function matchingBraceStart(src: string, closeIdx: number): number {
  let depth = 0;
  for (let i = closeIdx; i >= 0; i--) {
    if (src[i] === "}") depth++;
    else if (src[i] === "{") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** `{` konumundan ileri giderek eşleşen `}`ı bulur. */
function matchingBraceEnd(src: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

type TemplateMap = { line: number; fn: string; locales: string[] };

/** Bir dil haritasının ÜST SEVİYE dil anahtarları (`tr: {`, `en: {` ...). */
function localeKeys(body: string): string[] {
  return [...new Set([...body.matchAll(/^\s{2,}([a-z]{2}):\s*\{/gm)].map((k) => k[1]))];
}

/**
 * Dile göre indekslenen HER harita şablon değildir: `currencyLocaleFor` gibi
 * DEĞER haritaları da aynı kalıbı kullanabilir (`{ tr: "tr-TR", ... }[locale]`).
 * Ayırt edici, dil anahtarlarının NESNE taşıması — şablon `subject`/`body` tutar.
 */
function pushIfTemplate(out: TemplateMap[], before: string, locales: string[]): void {
  if (locales.length === 0) return;
  out.push({ line: before.split("\n").length, fn: enclosingFn(before), locales });
}

function enclosingFn(before: string): string {
  const fns = [...before.matchAll(/async (\w+)\(/g)];
  return fns.length ? fns[fns.length - 1][1] : "?";
}

/**
 * İKİ kalıbı da tanır:
 *
 *   - `pickLocale({ tr: {...}, ... }, locale)`  — 2026-08-25 sonrası
 *   - `{ tr: {...}, ... }[locale] ?? {...}`     — eski kalıp
 *
 * İkincisi hâlâ taranıyor çünkü tüm şablonlar henüz göç etmedi. Yeni bir kalıp
 * eklenirse "şablon sayısı" testi bunu fark eder — sessizce kapsam dışı kalamaz.
 */
function findTemplateMaps(file: string): TemplateMap[] {
  const src = fs.readFileSync(file, "utf8");
  const out: TemplateMap[] = [];

  for (const m of src.matchAll(/pickLocale\(\{/g)) {
    const open = m.index! + m[0].length - 1;
    const close = matchingBraceEnd(src, open);
    if (close < 0) continue;
    const before = src.slice(0, open);
    pushIfTemplate(out, before, localeKeys(src.slice(open, close + 1)));
  }

  for (const m of src.matchAll(/\}\[locale\]\s*\?\?/g)) {
    const close = m.index!;
    const open = matchingBraceStart(src, close);
    if (open < 0) continue;
    const before = src.slice(0, open);
    pushIfTemplate(out, before, localeKeys(src.slice(open, close + 1)));
  }

  return out;
}

const NOTIFICATION_SOURCES = [
  "src/services/NotificationService.ts",
  "src/lib/mail.ts",
].map((p) => path.join(process.cwd(), p));

describe("e-posta şablonları her dili kapsıyor", () => {
  const maps = NOTIFICATION_SOURCES.filter((f) => fs.existsSync(f)).flatMap((f) =>
    findTemplateMaps(f).map((m) => ({ ...m, file: path.relative(process.cwd(), f) })),
  );

  it("taranan şablon sayısı beklenenden az değil", () => {
    // Bir sablon `?? ` kalibindan cikarilirsa bu test onu FARK EDER; aksi halde
    // kapsam sessizce daralir ve mandal bos yere yesil kalir.
    expect(
      maps.length,
      "Şablon haritası bulunamadı — kalıp değiştiyse bu testin tarayıcısı da güncellenmeli.",
    ).toBeGreaterThanOrEqual(6);
  });

  it.each(LOCALES)("`%s` dili hiçbir şablonda atlanmıyor", (locale) => {
    const missing = maps
      .filter((m) => !m.locales.includes(locale))
      .map((m) => `${m.file}:${m.line} (${m.fn})`);

    expect(
      missing,
      `Bu şablonlar \`${locale}\` dilini taşımıyor. \`?? \` yedeği devreye girer ve ` +
        `misafir Türkçe, HTML'siz bir e-posta alır:\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("şablonlar DESTEKLENMEYEN bir dil taşımıyor", () => {
    // 2026-08-22'de 14 dilden 6'ya inildi. Kaldirilan bir dilin sablonda kalmasi
    // olu koddur ve bir sonraki okuyucuya "bu dil destekleniyor" der.
    const extra = maps
      .flatMap((m) => m.locales.filter((l) => !(LOCALES as readonly string[]).includes(l)).map((l) => `${m.file}:${m.line} → ${l}`))
      .sort();
    expect(extra, `Desteklenmeyen dil şablonda duruyor:\n${extra.join("\n")}`).toEqual([]);
  });
});
