import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { escapeEmailHtml, renderEmailHtml } from "@/lib/email-template";

/**
 * E-POSTA GOVDESINE GUVENILMEZ DEGER HAM GIRMEZ.
 *
 * NEDEN VAR (2026-08-31'de olculdu): `renderEmailHtml` aldigi dizeleri HTML
 * olarak basiyor -- oyle olmali, cunku sablonlar bilerek `<strong>` ve baglanti
 * tasiyor. Ama o dizelerin ICINE guvenilmez degerler enterpole ediliyordu.
 * En belirgini `shopName`: esnafin `updateShopSettingsAction` ile kendi yazdigi
 * dukkan adi, yirmi dort HTML alaninda (`heading`, `p1`, `p2`, `footer`)
 * kacirilmadan basiliyordu.
 *
 * Somut hali: bir esnaf dukkan adini
 *
 *     <a href="https://kotu/">Odemenizi tamamlayin</a>
 *
 * yaparsa, o dukkanla rezervasyon yapan MISAFIRLERE giden onay e-postasinda bu
 * baglanti cikiyordu. "Dukkan acildi" bildirimi ise ilgi kaydeden HERKESE
 * gidiyor -- yani tek bir dukkan adi cok sayida kutuya ulasiyor.
 *
 * Bu XSS DEGIL: e-posta istemcileri script calistirmaz. Bazi acilardan daha
 * kotu -- platformun KENDI gonderim alanindan, kendi sablonuyla, yuksek teslim
 * edilebilirlikle giden bir oltalama baglantisi. Kullanicinin guvenmesi icin
 * her sebebi var.
 *
 * `subject` ve `body` KAPSAM DISI ve bilerek: ikisi de duz metin, orada
 * kacirmak kullaniciya `&amp;` gosterir -- yani gorunur bir hata uretir.
 */

const ROOT = path.resolve(__dirname, "../..");
const SERVICE = path.join(ROOT, "src/services/NotificationService.ts");

/** `renderEmailHtml`e HTML olarak giden alanlar. */
const HTML_KEYS = ["heading", "p1", "p2", "p3", "p2Link", "footer", "cta"];

describe("e-posta govdesine HTML enjekte edilemez", () => {
  it("hicbir HTML alaninda ham `shopName` kalmadi", () => {
    const src = fs.readFileSync(SERVICE, "utf8");
    const offenders: string[] = [];
    const keyRe = new RegExp(`^\\s*(${HTML_KEYS.join("|")}):\\s`);
    src.split("\n").forEach((line, i) => {
      if (!keyRe.test(line)) return;
      // `${shopName}` ham; `${shopNameHtml}` kacirilmis.
      if (/\$\{shopName\}/.test(line)) {
        offenders.push(`NotificationService.ts:${i + 1}: ${line.trim()}`);
      }
    });
    expect(
      offenders,
      "HTML olarak cizilen bir alanda ham `shopName` var. Esnafin yazdigi bir " +
        "dukkan adi, misafire giden e-postaya baglanti enjekte edebilir. " +
        "`shopNameHtml` kullanin:\n" + offenders.join("\n"),
    ).toEqual([]);
  });

  it("`escapeEmailHtml` baglanti enjeksiyonunu keser", () => {
    const payload = '<a href="https://kotu/">Odemenizi tamamlayin</a>';
    const out = escapeEmailHtml(payload);
    expect(out).not.toContain("<a");
    expect(out).not.toContain("<");
    expect(out).toContain("&lt;");
  });

  it("kacirilmis deger sablonun KENDI isaretlemesini bozmaz", () => {
    /*
      Sablonlar bilerek `<strong>` tasiyor; kacis yalnizca DEGERE uygulaniyor,
      sablona degil. Ikisinin ayri kaldigi burada olculuyor.
    */
    const html = renderEmailHtml({
      locale: "tr",
      heading: "Talebiniz Onaylandı",
      paragraphs: [`<strong>${escapeEmailHtml('Emanet & Co <script>')}</strong> onayladı.`],
      footer: "Kod: ABC123",
    });
    expect(html, "sablonun kendi <strong>'u durmali").toContain("<strong>");
    expect(html, "degerdeki etiket kacirilmis olmali").toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("`&` de kacirilir (varlik ayristirmasi)", () => {
    expect(escapeEmailHtml("Emanet & Co")).toBe("Emanet &amp; Co");
  });

  it("oznitelik sinirlari da kacirilir", () => {
    /*
      Deger bir gun `href="..."` gibi bir oznitelik icine girerse tirnaklar da
      kacirilmis olmali; simdi girmiyor ama kacis o gunu de karsiliyor.
    */
    const out = escapeEmailHtml(`" onmouseover="alert(1)`);
    expect(out).not.toContain('"');
    expect(out).toContain("&quot;");
  });
});
