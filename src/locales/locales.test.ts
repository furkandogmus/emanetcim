import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Çeviri bütünlüğü koruması.
 *
 * Neden var: 2026-08-22'de 14 dilin 12'sinin AYNI 138 anahtarı eksik olduğu ölçüldü.
 * Bunların 32'si misafire görünen yüzeydeydi ve en az biri (`Footer.sitemap`) canlıda
 * ham anahtar olarak ekrana basılıyordu; prod log'larında `MISSING_MESSAGE` hataları
 * akıyordu. Turist odaklı bir üründe Türkçe dışı diller tam da hedef kitle olduğu için
 * bu sessizce oluşabilen bir boşluktu — artık CI'da kırmızı yanıyor.
 */

const DIR = path.join(process.cwd(), "src/locales");
const BASE = "tr"; // referans dil: en zengin ve ürünün ana dili

/** Misafirin gördüğü namespace'ler — burada eksik anahtara TOLERANS YOK. */
const GUEST_FACING = ["Guest", "Common", "Footer", "Home", "Errors", "UserNav"];

/**
 * Misafir dışı yüzeylerde (Partner/Admin panelleri, şehir SEO sayfaları) hâlâ borç var.
 * Bu sayı bir MANDAL: düşebilir, ama yükselemez. Yeni bir özellik 12 dili
 * daha fazla geride bırakamaz.
 *
 * Borç kapatıldıkça bu sayıyı düşürün (kayıt: docs/DEFECT_BACKLOG.md → P1-12).
 */
const NON_GUEST_DEBT_CEILING = 106;

type Flat = Record<string, unknown>;

function flatten(obj: Record<string, unknown>, prefix = "", out: Flat = {}): Flat {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      flatten(v as Record<string, unknown>, key, out);
    } else {
      out[key] = v;
    }
  }
  return out;
}

function loadAll(): Record<string, Flat> {
  const out: Record<string, Flat> = {};
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".json"))) {
    out[f.replace(/\.json$/, "")] = flatten(
      JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")),
    );
  }
  return out;
}

/** "{query} yakınındaki" -> ["query"] */
function placeholders(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

const all = loadAll();
const locales = Object.keys(all).filter((l) => l !== BASE);
const baseKeys = Object.keys(all[BASE]);
const isGuestFacing = (k: string) =>
  GUEST_FACING.some((ns) => k.startsWith(`${ns}.`));

describe("çeviri dosyaları", () => {
  it("referans dil bulunuyor ve boş değil", () => {
    expect(baseKeys.length).toBeGreaterThan(500);
  });

  it.each(locales)("%s: her anahtarın tipi referansla aynı", (loc) => {
    // Neden önemli: bir anahtar bir dilde metin, başka dilde dizi olursa çağrı yeri
    // ya t() ya t.raw() kullanır ve DİĞER dilde bozulur. Gerçek örnek (2026-08-21):
    // oteller sayfası `t("faqs")[0].q` ile diziyi metin gibi okuyordu ve dört SSS
    // girdisi de boş render ediliyordu.
    const kind = (v: unknown) =>
      Array.isArray(v) ? "dizi" : v === null ? "null" : typeof v;
    const mismatches: string[] = [];
    for (const k of baseKeys) {
      if (!(k in all[loc])) continue;
      const a = kind(all[BASE][k]);
      const b = kind(all[loc][k]);
      if (a !== b) mismatches.push(`${k}: ${BASE}=${a} ${loc}=${b}`);
    }
    expect(mismatches, `${loc}: tip uyuşmazlığı t()/t.raw() çağrısını bozar`).toEqual(
      [],
    );
  });

  it.each(locales)(
    "%s: misafire görünen hiçbir anahtar eksik değil",
    (loc) => {
      const have = new Set(Object.keys(all[loc]));
      const missing = baseKeys.filter((k) => isGuestFacing(k) && !have.has(k));
      expect(
        missing,
        `${loc}.json içinde ${missing.length} misafir anahtarı eksik. ` +
          `Eksik anahtar canlıda ham metin olarak görünür (bkz. Footer.sitemap, 2026-08-22).`,
      ).toEqual([]);
    },
  );

  it.each(locales)("%s: interpolasyon yer tutucuları referansla aynı", (loc) => {
    const mismatches: string[] = [];
    for (const k of baseKeys) {
      if (!(k in all[loc])) continue;
      const a = placeholders(all[BASE][k]);
      const b = placeholders(all[loc][k]);
      if (a.join(",") !== b.join(",")) {
        mismatches.push(`${k}: ${BASE}={${a}} ${loc}={${b}}`);
      }
    }
    expect(
      mismatches,
      `${loc}: yer tutucu uyuşmazlığı çalışma zamanında hata verir veya yanlış render eder`,
    ).toEqual([]);
  });

  it.each(locales)("%s: referansta olmayan fazladan anahtar yok", (loc) => {
    const base = new Set(baseKeys);
    const extra = Object.keys(all[loc]).filter((k) => !base.has(k));
    expect(extra, `${loc}: ${BASE}.json'da karşılığı olmayan anahtarlar`).toEqual([]);
  });

  it("misafir dışı çeviri borcu artmıyor (mandal)", () => {
    let worst = 0;
    const perLocale: string[] = [];
    for (const loc of locales) {
      const have = new Set(Object.keys(all[loc]));
      const missing = baseKeys.filter((k) => !isGuestFacing(k) && !have.has(k));
      if (missing.length > worst) worst = missing.length;
      if (missing.length > 0) perLocale.push(`${loc}=${missing.length}`);
    }
    expect(
      worst,
      `Misafir dışı eksik anahtar tavanı ${NON_GUEST_DEBT_CEILING}, ölçülen en kötü: ${worst} ` +
        `(${perLocale.join(" ")}). Yeni özellik çeviri borcunu artırmış olabilir; ` +
        `ya çevirileri ekleyin ya da borcu bilinçli olarak kabul edip tavanı güncelleyin.`,
    ).toBeLessThanOrEqual(NON_GUEST_DEBT_CEILING);
  });
});
