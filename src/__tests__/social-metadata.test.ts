import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Paylaşım kartı meta etiketleri tek kaynaktan çıkmalı.
 *
 * NEDEN MANDAL: Next'te bir sayfa kendi `openGraph` nesnesini verdiğinde kök
 * yerleşimdekiyle alan alan BİRLEŞMEZ, bütünüyle yerini alır. Kök yerleşim
 * `og:image`, `siteName` ve `locale` tanımlıyordu; kendi başlığını veren her
 * sayfa üçünü de düşürüyordu. Üretimde ölçüldü (2026-08-31): 21 sayfanın
 * hiçbirinde `og:image` yoktu, yani WhatsApp/Facebook/LinkedIn'de paylaşılan
 * her bağlantı görselsiz çıkıyordu; ayrıca 19 sayfa kendi `twitter` bloğunu
 * vermediği için X kartında ANA SAYFANIN metnini gösteriyordu.
 *
 * Bu sessiz bir hata: sayfa açılıyor, test geçiyor, hiçbir şey kırılmıyor.
 * Yalnızca paylaşan kişi görüyor. Bu yüzden kod tarafında ölçülüyor.
 */
const APP = path.join(process.cwd(), "src", "app");

function tsxDosyalari(dir: string, out: string[] = []): string[] {
  for (const ad of readdirSync(dir)) {
    const p = path.join(dir, ad);
    if (statSync(p).isDirectory()) tsxDosyalari(p, out);
    else if (ad.endsWith(".tsx")) out.push(p);
  }
  return out;
}

describe("paylaşım kartı meta etiketleri", () => {
  it("hiçbir sayfa `openGraph` anahtarını elle yazmıyor", () => {
    const suclular: string[] = [];
    for (const dosya of tsxDosyalari(APP)) {
      const s = readFileSync(dosya, "utf-8");
      if (!s.includes("openGraph")) continue;
      /*
        Kök yerleşim İSTİSNA: `og:image`/`siteName`/`locale` varsayılanlarını o
        tanımlıyor ve kendi başlığını vermiyor, yani düşürdüğü bir şey yok.
      */
      if (dosya.endsWith(path.join("[locale]", "layout.tsx"))) continue;
      /*
        Olcut `socialMetadata` GECIYOR MU degil, `openGraph:` KALDI MI.
        Ilk yazdigimda ilkini olcuyordum ve mandal geri donusu YAKALAMADI:
        dosyada ice aktarma satiri durdugu icin "geciyor" saniliyordu.
      */
      if (/\bopenGraph\s*:/.test(s)) {
        suclular.push(path.relative(process.cwd(), dosya));
      }
    }
    expect(
      suclular,
      "Bu sayfalar `openGraph`ı elle kuruyor ve kökün `og:image`ini düşürüyor.\n" +
        "`socialMetadata({ url, title, description })` kullanın:\n" +
        suclular.map((f) => `  ${f}`).join("\n"),
    ).toEqual([]);
  });
});
