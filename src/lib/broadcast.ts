import type { BroadcastAudience } from "@prisma/client";

/** Yonetici duyurusu sinirlari. Mobil sayaclar ayni sayilari ve ayni olcuyu (kod noktasi) kullanir. */
export const BROADCAST_TITLE_MAX = 60;
export const BROADCAST_BODY_MAX = 180;
export const BROADCAST_REASON_MIN = 5;
export const BROADCAST_REASON_MAX = 500;
/** Platform genelinde iki gercek duyuru arasi en az bu kadar. Test gonderimi sayilmaz. */
export const BROADCAST_MIN_INTERVAL_MS = 10 * 60 * 1000;
/** Bu kadar suredir QUEUED/SENDING kalan satir yeniden baslatmada kaybolmus sayilir. */
export const BROADCAST_STUCK_MS = 30 * 60 * 1000;

export const BROADCAST_AUDIENCES = ["PARTNERS", "GUESTS", "ALL"] as const;

export type BroadcastContent = { titleTr: string; bodyTr: string; titleEn: string | null; bodyEn: string | null };

export type BroadcastContentError = "invalid_title" | "invalid_body";

/** Emoji tek karakter sayilsin diye kod noktasi: istemcideki sayac da `Array.from` ile sayar. */
export function charCount(s: string): number {
  return Array.from(s).length;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function parseAudience(v: unknown): BroadcastAudience | null {
  return typeof v === "string" && (BROADCAST_AUDIENCES as readonly string[]).includes(v)
    ? (v as BroadcastAudience)
    : null;
}

/**
 * Turkce baslik ve govde zorunlu; Ingilizce istege bagli ama verildiyse ikisi birden
 * verilir. Yarim Ingilizce (baslik var, govde yok) Ingilizce cihaza bos govde gonderirdi.
 */
export function parseBroadcastContent(
  body: Record<string, unknown>,
): { ok: true; content: BroadcastContent } | { ok: false; error: BroadcastContentError } {
  const titleTr = str(body.titleTr);
  const bodyTr = str(body.bodyTr);
  const titleEn = str(body.titleEn);
  const bodyEn = str(body.bodyEn);
  const titleOk = (t: string) => charCount(t) >= 1 && charCount(t) <= BROADCAST_TITLE_MAX;
  const bodyOk = (t: string) => charCount(t) >= 1 && charCount(t) <= BROADCAST_BODY_MAX;

  if (!titleOk(titleTr)) return { ok: false, error: "invalid_title" };
  if (!bodyOk(bodyTr)) return { ok: false, error: "invalid_body" };
  if (titleEn || bodyEn) {
    if (!titleOk(titleEn)) return { ok: false, error: "invalid_title" };
    if (!bodyOk(bodyEn)) return { ok: false, error: "invalid_body" };
  }
  return {
    ok: true,
    content: { titleTr, bodyTr, titleEn: titleEn || null, bodyEn: bodyEn || null },
  };
}

/**
 * Cihazin dili (`MobilePushToken.locale`, uygulama dil kodu yazar) Turkce ya da
 * bilinmiyorsa Turkce; baska bir dilse Ingilizce metin varsa Ingilizce. Almanca/Rusca
 * cihaz da Ingilizce alir: o dillerde metin yok, yabanci ziyaretci Ingilizceyi
 * Turkceden iyi okur. Ingilizce yoksa herkes Turkce alir.
 */
export function pickBroadcastText(
  c: BroadcastContent,
  locale: string | null | undefined,
): { lang: "tr" | "en"; title: string; body: string } {
  const lang = (locale ?? "").trim().toLowerCase().slice(0, 2);
  if (lang && lang !== "tr" && c.titleEn && c.bodyEn) {
    return { lang: "en", title: c.titleEn, body: c.bodyEn };
  }
  return { lang: "tr", title: c.titleTr, body: c.bodyTr };
}
