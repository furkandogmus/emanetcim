/**
 * Valiz durumu fotografi kurallari (2026-11-25) -- saf hesap, web + mobil + is ayni kaynak.
 *
 * Fotograf hasar itirazinda kanittir: teslim aninda dukkan operatoru (sahip ya da
 * personel) 1-3 kare ceker. Teslimden sonra kanit KILITLENIR: operator ancak teslim
 * oncesinde ya da teslimden sonraki kisa pencerede (kapidan gelen misafir hemen teslim
 * alinir, kare ondan sonra cekilir) ekleyip silebilir.
 */

export const BAG_PHOTO_MAX_PER_BOOKING = 3;
/** Istemci 1600 px / JPEG 0.7'ye sikistirir (~300-600 KB); 2 MB pay birakir. */
export const BAG_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const BAG_PHOTO_MAX_DIMENSION_PX = 4096;
/** Imzali okuma adresinin omru. Sizan adres en fazla bu kadar ise yarar. */
export const BAG_PHOTO_URL_TTL_SECONDS = 5 * 60;
export const BAG_PHOTO_RETENTION_DAYS = 30;
/** Teslimden sonra operatorun ekleyip silebildigi pencere. */
export const BAG_PHOTO_EDIT_WINDOW_AFTER_CHECK_IN_MIN = 60;
export const BAG_PHOTO_KEY_PREFIX = "bag-photos";

/** Itiraz bu durumlardayken fotograf silinmez. */
export const OPEN_DISPUTE_STATUSES: readonly string[] = ["OPEN", "IN_REVIEW"];

const DAY_MS = 24 * 60 * 60 * 1000;
const PRE_CHECK_IN = new Set(["APPROVED", "PAID", "WAITING_APPROVAL"]);

/** Operator su an fotograf ekleyip silebilir mi? */
export function bagPhotoEditWindowOpen(
  booking: { status: string; checkedInAt: Date | null },
  now: Date,
): boolean {
  if (PRE_CHECK_IN.has(booking.status)) return true;
  if (booking.status !== "CHECKED_IN" || !booking.checkedInAt) return false;
  return now.getTime() - booking.checkedInAt.getTime() <= BAG_PHOTO_EDIT_WINDOW_AFTER_CHECK_IN_MIN * 60_000;
}

export type RetentionSubject = {
  deletedAt: Date | null;
  booking: {
    status: string;
    checkedOutAt: Date | null;
    updatedAt: Date;
    dispute: { status: string; updatedAt: Date } | null;
  };
};

/**
 * Fotograf ne zaman silinir? `null` = simdilik silinmez (acik itiraz ya da rezervasyon
 * hala acik). Kural: teslimden 30 gun sonra; itiraz acildiysa kapanmasindan 30 gun
 * sonra (hangisi gec ise). Iptal edilen rezervasyonda son guncellemeden 30 gun sonra.
 * Itirazin kapanma ani ayri tutulmuyor; `Dispute.updatedAt` son durum degisikligidir.
 */
export function bagPhotoDeleteAt(p: RetentionSubject): Date | null {
  if (p.deletedAt) return p.deletedAt;
  const { booking } = p;
  if (booking.dispute && OPEN_DISPUTE_STATUSES.includes(booking.dispute.status)) return null;
  const end = booking.checkedOutAt ?? (booking.status === "CANCELLED" ? booking.updatedAt : null);
  if (!end) return null;
  let due = end.getTime() + BAG_PHOTO_RETENTION_DAYS * DAY_MS;
  if (booking.dispute) due = Math.max(due, booking.dispute.updatedAt.getTime() + BAG_PHOTO_RETENTION_DAYS * DAY_MS);
  return new Date(due);
}

export function bagPhotoRetentionDue(p: RetentionSubject, now: Date): boolean {
  const at = bagPhotoDeleteAt(p);
  return at !== null && at.getTime() <= now.getTime();
}

/** Saklama isinin aday sorgusu icin kesim ani: bundan eski biten rezervasyonlar. */
export function bagPhotoRetentionCutoff(now: Date): Date {
  return new Date(now.getTime() - BAG_PHOTO_RETENTION_DAYS * DAY_MS);
}
