/**
 * Gelen kutusu sınıflandırıcı — dış servis YOK, maliyet YOK.
 *
 * NEDEN VAR (P1-18): `destek@bagajpark.com`'a gelen HER e-posta sınıflandırılmadan
 * `ContactMessage` olarak yazılıyordu. 2026-08-22'de kutuda 67 mesaj vardı, 57'si
 * okunmamış ve ezici çoğunluğu soğuk pazarlama (`posta-recap@mail.instagram.com`,
 * "Launch your product to early users" vb.). Gerçek bir misafir şikâyeti bunların
 * arasında kaybolur — yani destek kanalının kendisi çalışmıyor demektir.
 *
 * Mimari yanlış şuydu: **bir destek kutusu ile bir e-posta çöplüğü aynı şey
 * sanılmıştı.** Kutu ne için olduğunu bilmiyordu.
 *
 * Sınıflandırma standart başlıklara dayanıyor, tahmine değil. `List-Unsubscribe`
 * RFC 2369'un toplu posta işaretidir ve meşru pazarlama gönderileri bunu koyar —
 * yani en güvenilir sinyal, spam filtresi kurmadan elde edilebilen sinyaldir.
 */

export type InboxCategory =
  /** Gerçek insan, cevap bekliyor. Varsayılan admin görünümü budur. */
  | "SUPPORT"
  /** Bülten, pazarlama, bildirim özeti. Okunması gerekmez. */
  | "BULK"
  /** Otomatik sistem postası (bounce, out-of-office, teslimat raporu). */
  | "AUTOMATED"
  /** Henüz sınıflandırılmadı — bu alan eklenmeden önce yazılmış satırlar. */
  | "UNCLASSIFIED";

export type ClassifierInput = {
  from: string;
  subject?: string | null;
  /** Webhook'un tam yükü; başlıklar buradan okunur. */
  raw?: unknown;
};

export type ClassificationResult = {
  category: InboxCategory;
  /** Kararı hangi sinyal verdi — operatör "neden buraya düştü" diye sorabilmeli. */
  reason: string;
};

/** İletişim formunun yazdığı konu öneki. Bu her zaman gerçek bir kullanıcıdır. */
const CONTACT_FORM_SUBJECT_PREFIX = "İletişim Formu:";

/**
 * Otomatik gönderici yerel-adları. Bir insan bu adresten yazmaz ve buraya gelen
 * cevap kimseye ulaşmaz.
 */
const AUTOMATED_LOCAL_PARTS = [
  "no-reply",
  "noreply",
  "no_reply",
  "donotreply",
  "do-not-reply",
  "mailer-daemon",
  "postmaster",
  "bounce",
  "bounces",
];

/** Toplu gönderim yerel-adları. */
const BULK_LOCAL_PARTS = [
  "newsletter",
  "news",
  "digest",
  "updates",
  "notifications",
  "notification",
  "marketing",
  "promo",
  "promotions",
  "campaign",
  "recap",
  "follow-suggestions",
  "hello",
  "team",
];

function headersOf(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return out;
  const obj = raw as Record<string, unknown>;
  // Resend yükü başlıkları farklı biçimlerde verebilir; ikisini de kabul ediyoruz.
  const candidates = [obj.headers, (obj.data as Record<string, unknown> | undefined)?.headers];
  for (const c of candidates) {
    if (Array.isArray(c)) {
      for (const h of c) {
        if (h && typeof h === "object") {
          const { name, value } = h as { name?: unknown; value?: unknown };
          if (typeof name === "string" && typeof value === "string") {
            out[name.toLowerCase()] = value;
          }
        }
      }
    } else if (c && typeof c === "object") {
      for (const [k, v] of Object.entries(c as Record<string, unknown>)) {
        if (typeof v === "string") out[k.toLowerCase()] = v;
      }
    }
  }
  return out;
}

/** `Ad Soyad <a@b.com>` -> `a@b.com` */
export function extractEmail(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim().toLowerCase();
}

function localPart(address: string): string {
  return address.split("@")[0] ?? "";
}

export function classifyInboxMessage(input: ClassifierInput): ClassificationResult {
  const subject = (input.subject ?? "").trim();

  // 1. İletişim formu her zaman destek. Bu bizim kendi yazdığımız biçim.
  if (subject.startsWith(CONTACT_FORM_SUBJECT_PREFIX)) {
    return { category: "SUPPORT", reason: "contact_form_subject" };
  }

  const headers = headersOf(input.raw);
  const address = extractEmail(input.from);
  const local = localPart(address);

  // 2. Otomatik posta başlıkları (RFC 3834 / yaygın kullanım).
  if (headers["auto-submitted"] && headers["auto-submitted"] !== "no") {
    return { category: "AUTOMATED", reason: "auto_submitted_header" };
  }
  if (headers["x-autoreply"] || headers["x-autorespond"]) {
    return { category: "AUTOMATED", reason: "autoreply_header" };
  }
  if (AUTOMATED_LOCAL_PARTS.some((p) => local === p || local.startsWith(`${p}+`) || local.startsWith(`${p}-`))) {
    return { category: "AUTOMATED", reason: "automated_sender_local_part" };
  }

  // 3. Toplu posta. `List-Unsubscribe` RFC 2369 işaretidir ve meşru pazarlama
  //    gönderileri bunu koyar — tahmin değil, standart.
  if (headers["list-unsubscribe"] || headers["list-id"]) {
    return { category: "BULK", reason: "list_unsubscribe_header" };
  }
  if (headers["precedence"] && /bulk|list|junk/i.test(headers["precedence"])) {
    return { category: "BULK", reason: "precedence_header" };
  }
  if (headers["x-campaign-id"] || headers["x-mailer-campaign"]) {
    return { category: "BULK", reason: "campaign_header" };
  }
  if (BULK_LOCAL_PARTS.some((p) => local === p || local.includes(p))) {
    return { category: "BULK", reason: "bulk_sender_local_part" };
  }

  /**
   * 4. Varsayılan DESTEK.
   *
   * Bilinçli olarak iyimser: bir pazarlama e-postasının destek kutusunda görünmesi
   * can sıkıcıdır, ama gerçek bir müşteri şikâyetinin toplu klasöre düşmesi
   * kabul edilemez. Hata payı ucuz olan tarafa bırakılıyor.
   */
  return { category: "SUPPORT", reason: "default" };
}
