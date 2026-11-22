/**
 * Valizi alma saati gectigi halde dukkanda bekleyen MISAFIRE hatirlatma takvimi.
 * Saf hesap: veritabanina dokunmaz, `OverdueGuestReminderService` kullanir.
 *
 * KARAR (2026-11-23, urun sahibi): ilk hatirlatma alma saatinden 30 dakika sonra,
 * ikincisi 24 saat sonra, sonra en fazla 24 saatte bir; toplam en fazla 7.
 * Ucret ve terk edilmis esya politikasi bu kararin DISINDA (henuz yok), metin
 * ucretten soz etmez.
 *
 * NEDEN ESKI ESIKLER (0,5/24/72/168/720 sa, `overdue-notice.ts`) DEGIL: o liste
 * ESNAF icin; esnafi gurultuye alistirmamak icin seyrek. Misafir ise valizini
 * almaya gelebilecek tek kisi ve ilk hafta her gun bir hatirlatma, bavulun
 * unutulmasini onleyen sey. Ikisi bilerek ayri.
 *
 * "Slot" = kacinci hatirlatma (1..7). Slot k'nin vakti:
 *   k = 1  -> +30 dakika
 *   k >= 2 -> +24*(k-1) saat   (24, 48, 72, 96, 120, 144)
 */

export const OVERDUE_GUEST_REMINDER_FIRST_AFTER_MINUTES = 30;
export const OVERDUE_GUEST_REMINDER_INTERVAL_HOURS = 24;
export const OVERDUE_GUEST_REMINDER_MAX = 7;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** Slot `k` icin alma saatinden itibaren gecmesi gereken sure (ms). */
export function overdueGuestReminderSlotOffsetMs(slot: number): number {
  if (slot <= 1) return OVERDUE_GUEST_REMINDER_FIRST_AFTER_MINUTES * MINUTE_MS;
  return (slot - 1) * OVERDUE_GUEST_REMINDER_INTERVAL_HOURS * HOUR_MS;
}

/**
 * Bu gecikmede vakti gelmis EN SON slot; hicbiri gelmediyse 0.
 * 7'de durur: bir ay unutulmus valiz icin bile yedinci slottan otesi yok.
 */
export function dueOverdueGuestReminderSlot(overdueMs: number): number {
  if (!Number.isFinite(overdueMs)) return 0;
  if (overdueMs < overdueGuestReminderSlotOffsetMs(1)) return 0;
  const byDay = 1 + Math.floor(overdueMs / (OVERDUE_GUEST_REMINDER_INTERVAL_HOURS * HOUR_MS));
  return Math.min(OVERDUE_GUEST_REMINDER_MAX, Math.max(1, byDay));
}

/**
 * Simdi GONDERILMESI gereken slot; yoksa `null`.
 *
 * Yalnizca vakti gelmis EN SON slot gonderilir. Kacirilan slotlar (is saatlerce
 * durduysa) geriye dogru tamamlanmaz: is geri geldiginde misafire ard arda uc
 * e-posta degil, tek bir guncel hatirlatma gider. Gonderilmis en buyuk slottan
 * kucuk ya da ona esit bir slot ASLA tekrar gonderilmez.
 */
export function nextOverdueGuestReminderSlot(
  overdueMs: number,
  sentSlots: readonly number[],
): number | null {
  const due = dueOverdueGuestReminderSlot(overdueMs);
  if (due === 0) return null;
  const lastSent = sentSlots.reduce((m, s) => (s > m ? s : m), 0);
  return due > lastSent ? due : null;
}
