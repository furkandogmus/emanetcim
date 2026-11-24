/**
 * Rezervasyon KAPATMA kurallarinin saf (Prisma'siz) cekirdegi.
 *
 * NEDEN AYRI: ayni sabitler uc yerde okunuyor -- servis (kapiyi uygular),
 * mobil DTO (`noShowAvailableAt`, `cancelReason`) ve web esnaf ekrani ("Misafir
 * gelmedi" dugmesinin ne zaman acilacagi). Sayi bir yerde 60, digerinde 30
 * olursa esnaf aktif gorunen dugmeye basip `too_early` yer.
 *
 * Yeni bir `BookingStatus` degeri EKLENMEDI (migrasyon yok): her kapanis
 * `CANCELLED` olur, NEDENI `CANCELLED` olayinin `metadata.reason` alanindadir.
 */

/** `CANCELLED` olayina yazilan kapanis nedeni. Mobil sozlesme bu degerleri tasir. */
export const CANCEL_REASONS = [
  "guest_cancel",
  "partner_cancel",
  "no_show",
  "admin_cancel",
  "expired_no_dropoff",
] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];

/** Esnafin iptal ederken secebildigi alt neden. `other` aciklama ister. */
export const PARTNER_CANCEL_REASONS = ["guest_request", "shop_closed", "capacity", "other"] as const;
export type PartnerCancelReason = (typeof PARTNER_CANCEL_REASONS)[number];

export function isPartnerCancelReason(v: unknown): v is PartnerCancelReason {
  return typeof v === "string" && (PARTNER_CANCEL_REASONS as readonly string[]).includes(v);
}

/** Misafir gelmedi ancak check-in saatinden bu kadar sonra isaretlenebilir. */
export const NO_SHOW_GRACE_MINUTES = 60;

/** Yonetici iptali / zorla teslim aciklamasinin en kisa boyu. */
export const ADMIN_NOTE_MIN_LENGTH = 5;

/** Valiz HIC birakilmamis durumlar: iptal, gelmedi ve suresi dolma bunlara uygulanir. */
export const NOT_DROPPED_STATUSES = ["PENDING", "WAITING_APPROVAL", "APPROVED", "PAID"] as const;

export function isNotDroppedStatus(status: string): boolean {
  return (NOT_DROPPED_STATUSES as readonly string[]).includes(status);
}

/**
 * Suresi dolmus (gelinmemis) rezervasyon: bekleyen/onayli/odenmis, valiz hic teslim
 * edilmemis ve alma saati gecmis. Kural SUNUCUDA: web ve mobil ayni cevabi gorur,
 * cihaz saati yanlis olan turist bos bir QR gostermez. Durum bilerek degismez
 * (sure asimi taramasi yalnizca isaretler), bu yuzden bu bir turetilmis alandir.
 */
export function isBookingExpired(b: { status: string; checkOutTime: Date }, now: Date = new Date()): boolean {
  return isNotDroppedStatus(b.status) && b.checkOutTime.getTime() < now.getTime();
}

/**
 * Misafirin kendi iptalinin nedeni. Suresi dolmus (valiz hic birakilmamis)
 * rezervasyonu kapatmak gercek bir iptal degil: `expired_no_dropoff` yazilir ve
 * esnafa "iptal edildi" push'u gitmez (dukkan icin is degisikligi yok). Iade
 * davranisi ayni kalir. Web action'i ve mobil iptal ucu bunu okur.
 */
export function guestCancelOptions(
  b: { status: string; checkOutTime: Date },
  now: Date = new Date(),
): { reason: "guest_cancel" } | { reason: "expired_no_dropoff"; notifyPartner: false } {
  return isBookingExpired(b, now) ? { reason: "expired_no_dropoff", notifyPartner: false } : { reason: "guest_cancel" };
}

/**
 * "Misafir gelmedi" dugmesinin acildigi an; durum buna izin vermiyorsa `null`.
 * Gelecekte bir an da donebilir: istemci dugmeyi o ana kadar kapali tutar.
 */
export function noShowAvailableAt(b: { status: string; checkInTime: Date }): Date | null {
  if (!isNotDroppedStatus(b.status)) return null;
  return new Date(b.checkInTime.getTime() + NO_SHOW_GRACE_MINUTES * 60_000);
}

/**
 * Eski (bu modulden once yazilmis) red olaylarinin nedenleri. `rejectBooking`
 * hala bu degerleri yaziyor; okurken yeni sozlesmeye cevrilir.
 */
const LEGACY_REASON: Record<string, CancelReason> = {
  rejected_by_partner: "partner_cancel",
  cancelled_by_admin: "admin_cancel",
};

function reasonOf(metadata: unknown): CancelReason | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = (metadata as Record<string, unknown>).reason;
  if (typeof raw !== "string") return null;
  if ((CANCEL_REASONS as readonly string[]).includes(raw)) return raw as CancelReason;
  return LEGACY_REASON[raw] ?? null;
}

/**
 * Olay defterinden kapanis nedeni: nedeni olan EN SON `CANCELLED` olayi.
 * Eski red yolu iki `CANCELLED` olayi yaziyordu (biri nedensiz), bu yuzden
 * "son olay" degil "nedeni olan son olay" aranir. Neden yoksa `null`.
 */
export function cancelReasonFromEvents(
  events: ReadonlyArray<{ event: string; metadata?: unknown; createdAt: Date }>,
): CancelReason | null {
  let best: { at: number; reason: CancelReason } | null = null;
  for (const e of events) {
    if (e.event !== "CANCELLED") continue;
    const reason = reasonOf(e.metadata);
    if (!reason) continue;
    const at = e.createdAt.getTime();
    if (!best || at >= best.at) best = { at, reason };
  }
  return best?.reason ?? null;
}
