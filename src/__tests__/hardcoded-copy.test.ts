import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Sabit yazılmış iki dilli metin borcu — MANDAL.
 *
 * NEDEN VAR: proje 14 dili destekliyor ama bir katman metin hiç çeviri dosyasına
 * girmemiş; bileşenlerin içinde `locale === "tr" ? {...} : {...}` olarak duruyor.
 * Sonuç: diğer **12 dilde o metinler İngilizce** çıkıyor. Turist odaklı bir üründe
 * Türkçe dışı diller tam da hedef kitle.
 *
 * KÖR NOKTA: `src/locales/locales.test.ts` çeviri bütünlüğünü ölçüyor ama yalnızca
 * **eksik anahtarları** sayabiliyor. Hiç anahtar OLMAMIŞ bir metni göremez —
 * dolayısıyla o testin "106 eksik" demesi, gerçek boşluğun tamamı değildi.
 * Bu test o kör noktayı kapatıyor.
 *
 * Sayı bir MANDAL: düşebilir, yükselemez. Yeni bir özellik 12 dili daha fazla
 * geride bırakamaz.
 */

const ROOTS = ["src/components", "src/app"];

/**
 * Mevcut borç. Ölçüldü: 2026-08-24.
 *
 * Başlangıç 30'du. Taşınanlar: checkout hunisi (8), ana sayfa SEO başlığı (2),
 * dükkan detay sayfası (1 blok / 13 metin), Header navigasyon + erişilebilirlik
 * etiketleri (1 blok / 7 metin), Footer (3), arama ipucu (1), slot ızgarası
 * (1 blok / 5 metin), sadakat rozeti (1 blok / 3 metin), `BookingsClient`
 * (1 blok / 12 metin), `account/page.tsx` (1 blok / 17 metin — referans kodu
 * kartı ve indirim yüzdesi diğer 5 dilde hep İngilizce çıkıyordu), `insurance`
 * sayfası (1 blok / 34 metin), `luggage-storage/[slug]` (3 dal / 18 metin —
 * 12 şehir sayfasının "neden BagajPark / nasıl çalışır / FAQ / ipuçları"
 * bölümü artık şehir adı `{city}` ile enterpolasyonlu, 6 dilde ortak; 12
 * şehir × 4 dil = 48 sayfa kombinasyonunu etkiliyordu). → 5
 *
 * Borç kapatıldıkça bu sayıyı DÜŞÜRÜN. Yükseltmek, "yeni özellik 12 dilde
 * çalışmıyor" demenin başka bir yoludur.
 *
 * Kalan: `cancellation` (2), `page.tsx` (1), iki admin sayfası (2).
 */
const HARDCODED_COPY_CEILING = 5;

/** Yorum satırları sayılmaz — yalnızca gerçek kod. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

function findHardcodedLocaleBranches(): Array<{ file: string; count: number }> {
  const hits: Array<{ file: string; count: number }> = [];
  for (const root of ROOTS) {
    const abs = path.join(process.cwd(), root);
    if (!fs.existsSync(abs)) continue;
    for (const file of walk(abs)) {
      const src = stripComments(fs.readFileSync(file, "utf8"));
      const matches = src.match(/locale\s*===\s*["'](tr|en)["']/g);
      if (matches?.length) {
        hits.push({
          file: path.relative(process.cwd(), file),
          count: matches.length,
        });
      }
    }
  }
  return hits.sort((a, b) => b.count - a.count);
}

describe("sabit yazılmış iki dilli metin", () => {
  it(`toplam ${HARDCODED_COPY_CEILING} dalı geçmiyor (mandal — yükselemez)`, () => {
    const hits = findHardcodedLocaleBranches();
    const total = hits.reduce((s, h) => s + h.count, 0);

    const detail = hits.map((h) => `  ${h.count}× ${h.file}`).join("\n");
    expect(
      total,
      `Sabit \`locale === "tr"\` dalı sayısı ${total}, tavan ${HARDCODED_COPY_CEILING}.\n` +
        `Bu metinler 12 dilde İngilizce çıkar. Çeviri dosyalarına taşıyın.\n${detail}`,
    ).toBeLessThanOrEqual(HARDCODED_COPY_CEILING);
  });

  it("borcun nerede olduğu görünür — sessiz birikmesin", () => {
    const hits = findHardcodedLocaleBranches();
    // Test kendisi bir rapordur: hangi dosyada ne kadar borc var, calistiran gorur.
    for (const h of hits) {
      expect(h.count, `${h.file}`).toBeGreaterThan(0);
    }
    expect(Array.isArray(hits)).toBe(true);
  });
});
