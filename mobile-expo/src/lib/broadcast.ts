import { ApiError } from "./api";
import { errorMessage } from "./errors";
import i18n from "./i18n";
import type { AdminBroadcast, BroadcastAudience } from "./types";

/** Sunucudaki sinirlarla ayni (`../src/lib/broadcast.ts`); sayac da kod noktasi sayar. */
export const BROADCAST_TITLE_MAX = 60;
export const BROADCAST_BODY_MAX = 180;
export const BROADCAST_REASON_MIN = 5;
/** Gecmis listesi gonderim surerken bu aralikla yenilenir. */
export const BROADCAST_POLL_MS = 4000;

export const BROADCAST_AUDIENCES: BroadcastAudience[] = ["PARTNERS", "GUESTS", "ALL"];

export type BroadcastForm = {
  audience: BroadcastAudience | null;
  titleTr: string;
  bodyTr: string;
  titleEn: string;
  bodyEn: string;
  reason: string;
};

export const EMPTY_BROADCAST_FORM: BroadcastForm = {
  audience: null,
  titleTr: "",
  bodyTr: "",
  titleEn: "",
  bodyEn: "",
  reason: "",
};

export function charCount(s: string): number {
  return Array.from(s.trim()).length;
}

const fits = (s: string, max: number) => charCount(s) >= 1 && charCount(s) <= max;

/** TR icerik gecerli; Ingilizce bos ya da iki alani da gecerli. Test gonderimi de bunu ister. */
export function isContentValid(f: BroadcastForm): boolean {
  if (!fits(f.titleTr, BROADCAST_TITLE_MAX) || !fits(f.bodyTr, BROADCAST_BODY_MAX)) return false;
  if (!f.titleEn.trim() && !f.bodyEn.trim()) return true;
  return fits(f.titleEn, BROADCAST_TITLE_MAX) && fits(f.bodyEn, BROADCAST_BODY_MAX);
}

/** "Gonder" ancak kitle secili, icerik gecerli ve gerekce en az 5 karakterse acilir. */
export function canSendBroadcast(f: BroadcastForm): boolean {
  return f.audience !== null && isContentValid(f) && charCount(f.reason) >= BROADCAST_REASON_MIN;
}

export function contentBody(f: BroadcastForm) {
  const en = f.titleEn.trim() || f.bodyEn.trim();
  return {
    titleTr: f.titleTr.trim(),
    bodyTr: f.bodyTr.trim(),
    ...(en ? { titleEn: f.titleEn.trim(), bodyEn: f.bodyEn.trim() } : {}),
  };
}

/** Listede hala ilerleyen bir gonderim var mi: varsa gecmis yoklanir, yoksa durur. */
export function hasActiveBroadcast(items: AdminBroadcast[] | undefined): boolean {
  return !!items?.some((b) => b.status === "QUEUED" || b.status === "SENDING");
}

/** `too_soon` kalan dakikayi soyler (yukari yuvarlanir); digerleri `broadcast.errors.*`. */
export function broadcastErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.code === "too_soon") {
    const body = err.body as { retryAfterSeconds?: unknown } | undefined;
    const seconds = typeof body?.retryAfterSeconds === "number" ? body.retryAfterSeconds : 600;
    return i18n.t("broadcast.errors.too_soon", { count: Math.max(1, Math.ceil(seconds / 60)) });
  }
  return errorMessage(err, "broadcast");
}
