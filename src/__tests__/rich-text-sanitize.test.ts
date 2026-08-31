import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { sanitizeRichText } from "@/lib/rich-text";

/**
 * YONETICI YAZDIGI ZENGIN METIN TEMIZLENIR.
 *
 * NEDEN VAR: `blog/[slug]` sayfasi `post.content`i `dangerouslySetInnerHTML`
 * ile HAM basiyordu. Icerigi yonetici yaziyor, yani zengin metin BILINCLI bir
 * ozellik -- ama tek savunma "yoneticiye guveniyoruz" olamaz. Hesap ele
 * gecirilirse depolanmis XSS siteyi ziyaret eden HERKESI vurur, ve CSP'de
 * `'unsafe-inline'` oldugu icin enjekte edilen script CALISIR.
 *
 * Bu oturumda ayni sinifin iki ornegi zaten bulunmustu (JSON-LD'ye ve e-posta
 * govdesine giren dukkan adi); ikisi de "guvenilir" sanilan kaynaklardi.
 */

const ROOT = path.resolve(__dirname, "../..");

describe("zengin metin temizleme", () => {
  it("`<script>` tamamen atilir", () => {
    const out = sanitizeRichText('<p>Merhaba</p><script>fetch("//kotu")</script>');
    expect(out).not.toContain("script");
    expect(out, "mesru icerik korunmali").toContain("<p>Merhaba</p>");
  });

  it("olay oznitelikleri atilir (`onerror`, `onclick`)", () => {
    /*
      `<img src=x onerror=...>` script etiketi olmadan kod calistirmanin en
      yaygin yolu; izin listesi `onerror`i hic tanimadigi icin duser.
    */
    const out = sanitizeRichText('<img src="x" onerror="alert(1)"><p onclick="alert(2)">a</p>');
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("alert");
  });

  it("`javascript:` baglantisi duser, `https:` kalir", () => {
    const kotu = sanitizeRichText('<a href="javascript:alert(1)">tikla</a>');
    expect(kotu).not.toContain("javascript:");

    const iyi = sanitizeRichText('<a href="https://ornek.test">tikla</a>');
    expect(iyi).toContain('href="https://ornek.test"');
  });

  it("`data:` gorsel semasi duser", () => {
    const out = sanitizeRichText('<img src="data:text/html;base64,PHNjcmlwdD4=">');
    expect(out).not.toContain("data:");
  });

  it("`iframe`, `object`, `form`, `style` atilir", () => {
    const out = sanitizeRichText(
      '<iframe src="//kotu"></iframe><object data="x"></object>' +
        '<form action="//kotu"><input name="p"></form><style>body{display:none}</style>',
    );
    for (const etiket of ["iframe", "object", "form", "input", "style"]) {
      expect(out, `${etiket} kalmamali`).not.toContain(`<${etiket}`);
    }
  });

  it("`style` OZNITELIGI atilir, `class` KALIR", () => {
    /*
      `class` serbest cunku yazilar `prose` siniflarina dayaniyor. `style`
      degil: icinden tam ekran katman kurup kullaniciyi kandirmak mumkun.
    */
    const out = sanitizeRichText('<p class="lead" style="position:fixed;inset:0">a</p>');
    expect(out).toContain('class="lead"');
    expect(out).not.toContain("style=");
  });

  it("mesru blog bicimlendirmesi BOZULMAZ", () => {
    /*
      Temizleyicinin degeri, yasakladigi kadar izin verdigiyle de olculur:
      cok agresif bir liste mevcut yazilari bozar ve sonra gevsetilir.
    */
    const kaynak =
      '<h2>Baslik</h2><p>Bir <strong>kalin</strong> ve <em>italik</em> metin.</p>' +
      '<ul><li>Madde</li></ul><blockquote>Alinti</blockquote>' +
      '<img src="https://ornek.test/a.jpg" alt="gorsel">' +
      '<table><tbody><tr><td>huc</td></tr></tbody></table><pre><code>kod</code></pre>';
    const out = sanitizeRichText(kaynak);
    for (const parca of ["<h2>", "<strong>", "<em>", "<ul>", "<li>", "<blockquote>",
                          "<img", "<table>", "<pre>", "<code>"]) {
      expect(out, `${parca} korunmali`).toContain(parca);
    }
  });

  it("`target` verilmis baglantiya `rel=noopener` eklenir", () => {
    const out = sanitizeRichText('<a href="https://ornek.test" target="_blank">a</a>');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it("bos / null govde bos dize doner", () => {
    expect(sanitizeRichText(null)).toBe("");
    expect(sanitizeRichText(undefined)).toBe("");
    expect(sanitizeRichText("")).toBe("");
  });

  it("blog sayfasi HAM `post.content` basmiyor", () => {
    /*
      Mandal: temizleyici var olup CAGRILMAZSA hicbir sey degismis olmaz.
    */
    const src = fs
      .readFileSync(path.join(ROOT, "src/app/[locale]/blog/[slug]/page.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    expect(src).toMatch(/sanitizeRichText\(post\.content\)/);
    expect(src).not.toMatch(/__html:\s*post\.content\b/);
  });
});
