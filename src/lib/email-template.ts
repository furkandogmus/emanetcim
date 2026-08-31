/**
 * E-posta HTML kabugu — TEK yerde.
 *
 * NEDEN VAR (2026-08-25'te olculdu): `NotificationService` 913 satirdi ve ayni
 * markup **18 kez** kopyalanmisti (3 sablon x 6 dil). Olculen tekrar:
 *
 *   `font-family:sans-serif;max-width:600px`   22 kez
 *   marka rengi `#ea580c`                      32 kez
 *   buton stili                                13 kez
 *
 * Iki somut sonucu vardi:
 *
 *   1. **Gorunum degistirilemiyordu.** Marka rengini degistirmek ya da footer'a
 *      bir satir eklemek 18 ayri yerde ayni duzenlemeyi yapmak demekti. Sitenin
 *      geri kalani `globals.css` kimlik katmanindan besleniyor; e-postalar o
 *      katmanin HIC ulasmadigi tek yuzeydi.
 *   2. **Kopyalar zaten ayrisimisti.** Ornegin footer'in `margin-top:24px`i
 *      yalnizca BIR sablonda vardi; digerlerinde yoktu. Kimse fark etmemisti
 *      cunku karsilastirmak icin 18 blogu yan yana koymak gerekiyordu.
 *
 * Bu modul yalnizca KABUGU tasir. Metinlerin tamami cagirandaki dil haritasinda
 * kalir — `notification-locale-coverage` mandali orayi tam tutar.
 *
 * E-POSTA HTML'I NEDEN INLINE STIL: Gmail/Outlook `<style>` blogunu ve harici
 * CSS'i eler. CSS degiskeni de calismaz; bu yuzden kimlik katmani buraya
 * BAGLANAMAZ ve renkler burada sabit durur. Tek yerde durmalari yeterli.
 */

/** Marka vurgusu. `--brand-600` ile ayni deger; e-postada degisken kullanilamaz. */
export const EMAIL_BRAND_COLOR = "#ea580c";
/** Ikincil metin / notr baslik. */
export const EMAIL_MUTED_COLOR = "#6b7280";
/** Tablo satirlarinin sirali zebra zemini. */
export const EMAIL_ZEBRA_BG = "#f9fafb";

/**
 * E-postanin TONU: baslik ve ana eylem dugmesi ayni renkten beslenir.
 *
 * Sitenin durum renkleriyle ayni sozluk (`emerald`/`red`/`blue`): bir e-postanin
 * ne anlattiği renginden okunur — yeni rezervasyon marka, onaylanmiş iş
 * başari, şikayet uyari, kayit bilgi.
 */
export const EMAIL_TONES = {
  brand: EMAIL_BRAND_COLOR,
  muted: EMAIL_MUTED_COLOR,
  /*
    `#15803d` (green-700), `#16a34a` (green-600) DEGIL. Olculdu 2026-08-31:
    yesil zemin uzerine BEYAZ yazi green-600'de 3.30:1 kaliyor ve WCAG AA'nin
    4.5 esigini gecmiyor. Bu ton hem baslikta hem ana eylem dugmesinde
    kullaniliyor, yani en cok okunan iki yerde. green-700 ayni anlami tasiyor
    ve 5.02:1 veriyor. Marka turuncusu DEGISTIRILMEDI -- o bir kimlik karari
    ve `docs/UX_AUDIT.md` #17'de kullaniciya birakildi.
  */
  success: "#15803d",
  alert: "#dc2626",
  info: "#2563eb",
} as const;

export type EmailTone = keyof typeof EMAIL_TONES;

/** Sagdan sola yazilan diller. Kabuga `dir="rtl"` bunlar icin basilir. */
const RTL_LOCALES = new Set(["fa", "ar", "he", "ur"]);

export type EmailRow = {
  label: string;
  value: string;
  /** Dikkat cekmesi gereken deger (ornegin sikayet nedeni) tonun rengiyle basilir. */
  emphasized?: boolean;
};

export type EmailCta = {
  href: string;
  label: string;
  /**
   * `button` dikkat cekmesi gereken ana eylem (bileti goruntule),
   * `link` ikincil baglanti (iptal bildiriminde "yeniden rezervasyon").
   */
  variant: "button" | "link";
};

export type EmailContent = {
  locale: string;
  heading: string;
  /**
   * Baslik ve dugme rengi. Varsayilan marka; iptal `muted`, onaylanmis is
   * `success`, sikayet `alert`, yeni kayit `info`.
   */
  tone?: EmailTone;
  /**
   * Govde paragraflari. HTML KACISI YAPILMAZ: cagiran `<strong>` gibi
   * etiketleri bilerek gecirir. Metinler cevirilerden gelir, kullanici
   * girdisi DEGILDIR.
   */
  paragraphs: string[];
  /** Etiket/deger tablosu (referans no, tutar...). Bos verilirse cizilmez. */
  rows?: EmailRow[];
  cta?: EmailCta;
  footer: string;
};

function renderRows(rows: EmailRow[], accent: string): string {
  const cells = rows
    .map(
      (r, i) =>
        `<tr${i % 2 === 1 ? ` style="background:${EMAIL_ZEBRA_BG}"` : ""}>` +
        `<td style="padding:8px;color:${EMAIL_MUTED_COLOR}">${r.label}</td>` +
        `<td style="padding:8px;font-weight:bold${r.emphasized ? `;color:${accent}` : ""}">` +
        `${r.value}</td>` +
        `</tr>`,
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0">${cells}</table>`;
}

function renderCta(cta: EmailCta, accent: string): string {
  if (cta.variant === "link") {
    return `<p><a href="${cta.href}" style="color:${accent}">${cta.label}</a></p>`;
  }
  return (
    `<a href="${cta.href}" style="display:inline-block;background:${accent};` +
    `color:white;padding:12px 24px;text-decoration:none;border-radius:8px;` +
    `font-weight:bold;margin:16px 0">${cta.label}</a>`
  );
}

/**
 * Kabugu cizer. Tek cikis noktasi: her e-posta ayni genislik, ayni tipografi ve
 * ayni footer bosluguyla gelir.
 *
 * Not: footer'in `margin-top:24px`i 2026-08-25'te TUM sablonlara yayildi;
 * oncesinde yalnizca `notifyBookingSuccess`'te vardi ve digerlerinde footer
 * govdeye yapisik duruyordu. Kasitli ve gorunur bir duzeltme.
 */
export function renderEmailHtml(content: EmailContent): string {
  const dir = RTL_LOCALES.has(content.locale) ? ` dir="rtl"` : "";
  /*
    `lang`: kabuk `dir`i basiyordu ama dili HIC soylemiyordu. Ekran okuyucu
    e-postayi yanlis telaffuz eder, Gmail/Apple Mail'in ceviri onerisi calismaz
    ve tireleme kurallari sasar. Dil zaten elimizde (`content.locale`); tek
    eksik onu yazmakti.
  */
  const lang = ` lang="${content.locale}"`;
  const accent = EMAIL_TONES[content.tone ?? "brand"];

  const parts = [
    `<h2 style="color:${accent}">${content.heading}</h2>`,
    ...content.paragraphs.map((p) => `<p>${p}</p>`),
    content.rows?.length ? renderRows(content.rows, accent) : "",
    content.cta ? renderCta(content.cta, accent) : "",
    `<p style="font-size:13px;color:${EMAIL_MUTED_COLOR};margin-top:24px">${content.footer}</p>`,
  ];

  return (
    `<div${dir}${lang} style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">` +
    parts.filter(Boolean).join("") +
    `</div>`
  );
}
