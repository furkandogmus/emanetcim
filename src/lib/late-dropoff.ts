/**
 * GEC BIRAKMA kuralinin saf (Prisma'siz) cekirdegi.
 *
 * Kural (isletme karari, 2026-11-23): valizini birakma saatine (`checkInTime`)
 * kadar birakmamis misafir gec kalmistir ve baskasinin kullanabilecegi yeri
 * tutmamalidir.
 *
 *   +15 / +30 / +45 dk  misafire hatirlatma (+45'te esnafa da)
 *   +60 dk              rezervasyon otomatik kapanir (`no_show`, `auto: true`)
 *
 * Esnaf "Misafiri bekle" ile kapanisi 30'ar dk ileri alir (`lateHoldUntil`);
 * bekletme surerken misafire hatirlatma gitmez. Valizi birakilmis
 * (`checkedInAt` dolu) rezervasyon ASLA kapanmaz.
 *
 * NEDEN AYRI: ayni an uc yerde okunuyor -- tarama isi (kapatir), mobil DTO
 * (`lateCloseAt`) ve web esnaf ekrani ("Otomatik kapanis"). Bir yerde 60,
 * digerinde 90 olursa esnaf ekranda gordugu saatten once kapanan bir kayitla
 * karsilasir.
 */
import { NOT_DROPPED_STATUSES, isNotDroppedStatus } from "@/lib/booking-closure";

const MINUTE_MS = 60_000;

/** Hatirlatma asamalari: birakma saatinden kac dk sonra. Sira = asama numarasi (1..3). */
export const LATE_REMINDER_OFFSETS_MIN = [15, 30, 45] as const;

/** Esnafin da uyarildigi asama (+45 dk). */
export const LATE_PARTNER_STAGE = 3;

/** Birakma saatinden bu kadar dk sonra hala birakilmamis rezervasyon kapanir. */
export const LATE_CLOSE_AFTER_MIN = 60;

/** "Misafiri bekle" her basista kapanisi bu kadar dk ileri alir. */
export const LATE_HOLD_EXTEND_MIN = 30;

/**
 * Kapanis ani bundan daha eskiyse rezervasyon SESSIZ kapanir: ne hatirlatma ne
 * "kapandi" bildirimi. Ilk yayinda prod'da birikmis eski kayitlara (gunler once
 * gelmemis misafirler) toplu bildirim gitmesin; kapanis zaten haber degeri
 * tasimiyor.
 */
export const LATE_SILENT_BACKLOG_MS = 2 * 60 * MINUTE_MS;

/**
 * Hatirlatma ve bekletmenin anlamli oldugu durumlar: check-in yapilabilenler
 * (`check-in.ts` yalnizca APPROVED / PAID kabul eder). PENDING / WAITING_APPROVAL
 * kayit (odemesi tamamlanmamis niyet) zaten teslim alinamaz; "dukkani ara" demek
 * yanlis olur. Onlar yalnizca kapanir.
 */
export const LATE_ACTIONABLE_STATUSES = ["APPROVED", "PAID"] as const;

export function isLateActionableStatus(status: string): boolean {
  return (LATE_ACTIONABLE_STATUSES as readonly string[]).includes(status);
}

export { NOT_DROPPED_STATUSES };

export type LateSubject = {
  status: string;
  checkInTime: Date;
  checkOutTime: Date;
  checkedInAt: Date | null;
  lateHoldUntil: Date | null;
};

/** Valiz hic birakilmamis ve kapanabilir mi. */
export function isLateClosable(b: Pick<LateSubject, "status" | "checkedInAt">): boolean {
  return isNotDroppedStatus(b.status) && b.checkedInAt == null;
}

/** Bekletme olmadan kapanis ani: `checkInTime + 60 dk`. */
export function baseLateCloseAt(checkInTime: Date): Date {
  return new Date(checkInTime.getTime() + LATE_CLOSE_AFTER_MIN * MINUTE_MS);
}

/**
 * Rezervasyonun otomatik kapanacagi an; kural uygulanmiyorsa (valiz birakildi,
 * iptal, teslim) `null`. Gelecekte bir an da donebilir: istemci "Otomatik
 * kapanis: HH:mm"yi ancak birakma saati gectiyse gosterir.
 */
export function lateCloseAt(b: LateSubject): Date | null {
  if (!isLateClosable(b)) return null;
  const base = baseLateCloseAt(b.checkInTime);
  const hold = b.lateHoldUntil;
  return hold && hold.getTime() > base.getTime() ? hold : base;
}

/** Bekletme su an suruyor mu. */
export function isLateHoldActive(b: Pick<LateSubject, "lateHoldUntil">, now: Date): boolean {
  return !!b.lateHoldUntil && b.lateHoldUntil.getTime() > now.getTime();
}

export function lateReminderOffsetMs(stage: number): number {
  return LATE_REMINDER_OFFSETS_MIN[stage - 1] * MINUTE_MS;
}

/**
 * Bu calismada gonderilecek hatirlatma asamasi; yoksa `null`.
 *
 * Asama ANCAK KENDI PENCERESINDEYKEN gider: pencere asamanin vaktinden bir
 * sonraki asamanin vaktine (son asamada kapanisa) kadardir. Bir sonraki asamanin
 * vakti gecmisse onceki asama ATLANIR -- cron birkac calisma kacirdiginda ya da
 * ilk yayinda misafire arka arkaya uc bildirim gitmesin (yetisme yagmuru yok).
 *
 * `sentStages` bu rezervasyona daha once sahiplenilmis asamalar; ayni ya da daha
 * ileri bir asama yazilmissa hicbir sey gonderilmez (5 dk'lik tarama iki kez
 * gondermez). Bekletme suruyorsa misafir zaten aramis demektir: hatirlatma yok.
 */
export function nextLateReminderStage(
  b: { checkInTime: Date; lateHoldUntil: Date | null },
  now: Date,
  sentStages: readonly number[],
): number | null {
  if (isLateHoldActive(b, now)) return null;
  const elapsed = now.getTime() - b.checkInTime.getTime();
  const closeOffset = LATE_CLOSE_AFTER_MIN * MINUTE_MS;
  if (elapsed >= closeOffset) return null;
  let due: number | null = null;
  for (let stage = 1; stage <= LATE_REMINDER_OFFSETS_MIN.length; stage++) {
    const start = lateReminderOffsetMs(stage);
    const end = stage < LATE_REMINDER_OFFSETS_MIN.length ? lateReminderOffsetMs(stage + 1) : closeOffset;
    if (elapsed >= start && elapsed < end) due = stage;
  }
  if (due == null) return null;
  const maxSent = sentStages.length ? Math.max(...sentStages) : 0;
  return due > maxSent ? due : null;
}

export type LateHoldDecision =
  | { ok: true; until: Date; previousCloseAt: Date }
  | { ok: false; code: "INVALID_STATUS" | "TOO_EARLY" | "HOLD_LIMIT" };

/**
 * "Misafiri bekle": kapanisi `max(simdi, mevcut kapanis) + 30 dk`ya tasir,
 * `checkOutTime`i asamaz. Tavana dayanmissa (`checkOutTime`) `HOLD_LIMIT`.
 * Birakma saatinden once anlamsiz (misafir gec kalmadi): `TOO_EARLY`.
 */
export function decideLateHold(b: LateSubject, now: Date): LateHoldDecision {
  if (!isLateActionableStatus(b.status) || b.checkedInAt != null) return { ok: false, code: "INVALID_STATUS" };
  if (now.getTime() < b.checkInTime.getTime()) return { ok: false, code: "TOO_EARLY" };
  const current = lateCloseAt(b);
  if (!current) return { ok: false, code: "INVALID_STATUS" };
  const from = Math.max(now.getTime(), current.getTime());
  const until = Math.min(from + LATE_HOLD_EXTEND_MIN * MINUTE_MS, b.checkOutTime.getTime());
  if (until <= current.getTime() || until <= now.getTime()) return { ok: false, code: "HOLD_LIMIT" };
  return { ok: true, until: new Date(until), previousCloseAt: current };
}

/** Kapanis cok once gecmis eski kayit mi (sessiz kapanir). */
export function isSilentBacklog(closeAt: Date, now: Date): boolean {
  return now.getTime() - closeAt.getTime() > LATE_SILENT_BACKLOG_MS;
}
