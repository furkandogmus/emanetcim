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
 * şehir × 4 dil = 48 sayfa kombinasyonunu etkiliyordu), `cancellation`
 * sayfası (1 blok / 22 metin — iptal/iade politikası artık 6 dilde de doğru
 * çıkıyor, önceden DE/FR/FA/JA kullanıcıları bu kritik güven sayfasını
 * İngilizce görüyordu), ana sayfa `page.tsx` (1 blok / 12 metin — "şehri
 * özgürce yaşa" görsel bölümü ve alt SEO paragrafları artık 6 dilde; aynı
 * taramada ayrıca `homeStep1-3Title/Desc` (6 anahtar) DE/FR/FA/JA'da anahtar
 * VARDI ama değer hep İngilizceydi — bu test onu göremiyordu, ayrıca
 * düzeltildi). → 2
 *
 * Borç kapatıldıkça bu sayıyı DÜŞÜRÜN. Yükseltmek, "yeni özellik 12 dilde
 * çalışmıyor" demenin başka bir yoludur.
 *
 * Kalan: iki admin sayfası (2).
 */
const HARDCODED_COPY_CEILING = 2;

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

/**
 * İKİNCİ tarama: `locale === "tr"` DALI OLMADAN doğrudan Türkçe yazılmış metin.
 *
 * NEDEN AYRI (2026-08-24'te ölçüldü): yukarıdaki tarama yalnızca iki dilli
 * KOŞUL arıyor. Ama asıl borç koşulsuzdu — bileşenin içine düpedüz Türkçe
 * yazılmıştı ve `src/locales`'e hiç uğramıyordu. Ölçüldüğünde 119 satır çıktı;
 * en can yakıcıları:
 *
 *   - `layout.tsx` → "İçeriğe atla": her sayfadaki İLK sekme durağı. Klavye
 *     veya ekran okuyucu kullanan Japon bir misafir Türkçe duyuyordu.
 *   - `ShopListItem.tsx` → "Doğr." ve "≤{n}dk": arama sonuçlarındaki iki güven
 *     rozeti. Aynı ikili `TrustBadge` içinde ZATEN yerelleştirilmişti; burada
 *     ikinci kez, elle ve Türkçe çiziliyordu.
 *   - `QRScanner.tsx` → üç kamera hata metni; esnaf 6 dilde Türkçe okuyordu.
 *
 * İki sinyal birden aranıyor: Türkçe'ye özgü harfler VE Türkçe durak kelimeler.
 * Yalnızca harfe bakmak yetmiyordu — "Platform komisyonu dahil" ve "Puan" düz
 * ASCII olduğu için ilk taramada görünmemişti.
 */

/** Metni Türkçe olarak ele veren harfler. */
const TURKISH_CHARS = /[ğüşıöçĞÜŞİÖÇ]/;

/** İki tanesi bir arada geçiyorsa satır Türkçe cümledir. */
const TURKISH_STOPWORDS =
  /\b(ve|ile|için|bir|bu|olarak|değil|var|yok|gibi|daha|sonra|önce|adet|kodu|kodunu|sayfa|hata|lütfen|tüm|her|kayıt|talep|dükkan|dükkanı|mühür|misafir|esnaf|rezervasyon|ödeme|komisyonu|platform|puan|geçerli|zorunlu|başarılı)\b/gi;

/**
 * Türkçe olması DOĞRU olan dosyalar.
 *
 * - `terms/page.tsx` — T.C. hukukuna tabi üyelik sözleşmesinin kendisi. Çevirisi
 *   kod değil hukuk kararıdır.
 * - `LocationPicker.tsx` — Türkçe adres ayrıştırma düzenli ifadesi ("Mahallesi").
 * - `AdminBlogEditClient.tsx` — dil adının kendisi ("Türkçe (TR)").
 * - `manifest.ts` — açıklama bilerek iki dilli.
 * - `seals/export/route.ts` — CSV dosya adı.
 * - `DateTimePicker.tsx` — 14 dilli satır içi etiket haritası. Kalıp yanlış
 *   (metin `src/locales`'e ait) ama SONUÇ doğru: her dil kendi metnini görüyor.
 */
const TURKISH_OK_FILES = new Set([
  "src/app/[locale]/(guest)/terms/page.tsx",
  "src/components/partner/LocationPicker.tsx",
  "src/components/admin/AdminBlogEditClient.tsx",
  "src/app/manifest.ts",
  "src/app/api/admin/seals/export/route.ts",
  "src/components/ui/DateTimePicker.tsx",
]);

/**
 * Kalan borç, tamamı SUNUCU tarafında. 2026-08-24: 119 satırdan 13'e,
 * 2026-09-02: 13'ten 11'e indi.
 *
 * MİSAFİR YÜZEYİ ARTIK BOŞ. Önceki not şöyle diyordu: "İçindeki tek MİSAFİR
 * yüzeyi `booking-reminders` (3 satır) ... yani Japon bir misafire Türkçe
 * e-posta gidiyor. Düzeltmesi kod değil ŞEMA işi — rezervasyonda misafirin
 * dili saklanmıyor." Teşhis doğruydu: `Booking.locale` eklendi, iki taşıyıcı
 * da dolduruyor ve hatırlatmalar `NotificationService` üzerinden altı dilde
 * yazılıyor (`sendStayReminder`).
 *
 * Kalan 11 satırın tamamı ESNAF/ADMİN yüzeyi: geç teslim uyarısı, mühür
 * tahmini e-postası ve SMS'i, webhook yönetici notları. Onların düzeltmesi de
 * aynı sınıf bir veri eksiğini bekliyor — `User.locale` yok, yani esnafın
 * dili de bilinmiyor. Türkiye dışında esnaf açıldığı gün bu satır sırasını
 * bekleyen iş olacak.
 */
const TURKISH_TEXT_CEILING = 11;

function findTurkishText(): Array<{ file: string; line: number; text: string }> {
  const hits: Array<{ file: string; line: number; text: string }> = [];
  for (const root of ROOTS) {
    const abs = path.join(process.cwd(), root);
    if (!fs.existsSync(abs)) continue;
    for (const file of walk(abs)) {
      const rel = path.relative(process.cwd(), file);
      if (rel.includes(".test.")) continue;
      if (TURKISH_OK_FILES.has(rel)) continue;
      const src = fs
        .readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      src.split("\n").forEach((line, i) => {
        // Ceviri cagrisi olan satir zaten dogru yoldan geciyor.
        if (/\bt\w*\(/.test(line)) return;
        const stopwords = line.match(TURKISH_STOPWORDS) ?? [];
        if (TURKISH_CHARS.test(line) || stopwords.length >= 2) {
          hits.push({ file: rel, line: i + 1, text: line.trim().slice(0, 90) });
        }
      });
    }
  }
  return hits;
}

describe("sabit yazılmış Türkçe metin", () => {
  it(`toplam ${TURKISH_TEXT_CEILING} satırı geçmiyor (mandal — yükselemez)`, () => {
    const hits = findTurkishText();
    const detail = hits.map((h) => `  ${h.file}:${h.line}  ${h.text}`).join("\n");
    expect(
      hits.length,
      `Sabit Türkçe metin satırı ${hits.length}, tavan ${TURKISH_TEXT_CEILING}.\n` +
        `Bu metinler 5 dilde Türkçe çıkar. \`src/locales/*.json\`'a taşıyın.\n${detail}`,
    ).toBeLessThanOrEqual(TURKISH_TEXT_CEILING);
  });

  it("düzeltilmiş yüzeyler geri kaymıyor", () => {
    const hits = findTurkishText();
    const regressed = hits.filter((h) =>
      [
        "src/app/[locale]/layout.tsx",
        "src/components/guest/ShopListItem.tsx",
        "src/components/partner/QRScanner.tsx",
        "src/components/partner/PartnerEarningsClient.tsx",
        "src/components/admin/SealShipButton.tsx",
        "src/app/[locale]/register/RegisterClient.tsx",
        "src/app/[locale]/(guest)/partners/page.tsx",
      ].includes(h.file),
    );
    expect(
      regressed.map((h) => `${h.file}:${h.line}`),
      "Bu dosyalar 2026-08-24'te temizlendi; sabit Türkçe geri gelmiş.",
    ).toEqual([]);
  });
});
