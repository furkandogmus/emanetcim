import { describe, it, expect } from "vitest";
import {
  renderEmailHtml,
  EMAIL_BRAND_COLOR,
  EMAIL_MUTED_COLOR,
} from "@/lib/email-template";

/**
 * E-posta kabugu — 2026-08-25'e kadar `NotificationService` icinde 18 kez
 * (3 sablon x 6 dil) kopyalanmis markup'ti. Bu testler kabugun tek yerde
 * durmasinin GORUNUR sonuclarini kilitler: RTL, marka rengi, tablo zebrasi ve
 * footer boslugu artik her e-postada AYNI.
 */

const BASE = {
  locale: "tr",
  heading: "Başlık",
  paragraphs: ["Merhaba."],
  footer: "BagajPark",
};

describe("renderEmailHtml", () => {
  it("kabuk DILI de basar, yalnizca yonu degil", () => {
    /*
      `dir` vardi ama `lang` yoktu. Dil olmadan ekran okuyucu e-postayi yanlis
      telaffuz eder, Gmail/Apple Mail'in ceviri onerisi calismaz ve tireleme
      kurallari sasar -- ustelik dil zaten elimizde.
    */
    expect(renderEmailHtml({ ...BASE, locale: "tr" })).toContain('lang="tr"');
    expect(renderEmailHtml({ ...BASE, locale: "fa" })).toContain('lang="fa"');
  });

  it("sağdan sola dillerde `dir=\"rtl\"` basar", () => {
    expect(renderEmailHtml({ ...BASE, locale: "fa" })).toContain('<div dir="rtl"');
    // LTR dillerde oznitelik HIC basilmaz — bos `dir=""` degil.
    expect(renderEmailHtml({ ...BASE, locale: "tr" })).not.toContain("dir=");
    expect(renderEmailHtml({ ...BASE, locale: "ja" })).not.toContain("dir=");
  });

  it("başlık tonu: varsayılan marka, olumsuz bildirimde nötr", () => {
    expect(renderEmailHtml(BASE)).toContain(`<h2 style="color:${EMAIL_BRAND_COLOR}">`);
    expect(renderEmailHtml({ ...BASE, tone: "muted" })).toContain(
      `<h2 style="color:${EMAIL_MUTED_COLOR}">`,
    );
  });

  it("boş bölümleri hiç çizmez", () => {
    const html = renderEmailHtml(BASE);
    expect(html).not.toContain("<table");
    expect(html).not.toContain("<a ");
    // Bos `rows: []` de tablo uretmemeli.
    expect(renderEmailHtml({ ...BASE, rows: [] })).not.toContain("<table");
  });

  it("tablo satırlarını zebralar — ikinci satır zeminli", () => {
    const html = renderEmailHtml({
      ...BASE,
      rows: [
        { label: "Referans", value: "abc123" },
        { label: "Tutar", value: "₺100,00" },
      ],
    });
    const rows = html.match(/<tr[^>]*>/g)!;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe("<tr>");
    expect(rows[1]).toContain("background:");
  });

  it("düğme ve bağlantı farklı çizilir", () => {
    const button = renderEmailHtml({
      ...BASE,
      cta: { href: "https://x/y", label: "Aç", variant: "button" },
    });
    expect(button).toContain("display:inline-block");
    expect(button).toContain(`background:${EMAIL_BRAND_COLOR}`);

    const link = renderEmailHtml({
      ...BASE,
      cta: { href: "https://x/y", label: "Aç", variant: "link" },
    });
    expect(link).toContain(`<p><a href="https://x/y" style="color:${EMAIL_BRAND_COLOR}">Aç</a></p>`);
    expect(link).not.toContain("display:inline-block");
  });

  it("footer HER e-postada aynı boşlukla gelir", () => {
    // 2026-08-25 oncesinde `margin-top:24px` yalnizca BIR sablonda vardi;
    // digerlerinde footer govdeye yapisik duruyordu. Kimse fark etmemisti cunku
    // karsilastirmak icin 18 blogu yan yana koymak gerekiyordu.
    for (const opts of [BASE, { ...BASE, tone: "muted" as const }, { ...BASE, locale: "fa" }]) {
      expect(renderEmailHtml(opts)).toContain(
        `<p style="font-size:13px;color:${EMAIL_MUTED_COLOR};margin-top:24px">BagajPark</p>`,
      );
    }
  });

  it("paragraf HTML'i KAÇIRILMAZ — çeviriler `<strong>` taşır", () => {
    // Metinler ceviri dosyalarindan gelir, kullanici girdisi degildir; iptal
    // bildirimi cumle ICINDE baglanti tasiyor.
    const html = renderEmailHtml({
      ...BASE,
      paragraphs: ["<strong>Dükkan</strong> onayladı."],
    });
    expect(html).toContain("<p><strong>Dükkan</strong> onayladı.</p>");
  });

  it("bölümleri sabit sırada dizer: başlık → metin → tablo → eylem → footer", () => {
    const html = renderEmailHtml({
      ...BASE,
      rows: [{ label: "a", value: "b" }],
      cta: { href: "https://x", label: "Aç", variant: "button" },
    });
    const order = ["<h2", "<p>", "<table", "<a href", "font-size:13px"].map((t) =>
      html.indexOf(t),
    );
    expect(order.every((v) => v >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
