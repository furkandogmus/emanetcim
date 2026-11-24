/**
 * Misafirin hasar/kayip itirazi acabilecegi sure (2026-11-25, sektor standardi): valiz
 * teslim edildikten (check-out) sonra 14 gun. Valiz dukkandayken sure islemez. Yonetici
 * itirazin durumunu her zaman degistirebilir (yeniden acma dahil); sinir yalniz misafirin
 * yeni itirazinda. Valiz fotograflari teslimden 30 gun saklanir, yani pencere icinde
 * acilan itirazin kaniti her zaman durur.
 */
export const DISPUTE_WINDOW_DAYS = 14;

export function disputeWindowOpen(booking: { status: string; checkedOutAt: Date | null }, now: Date): boolean {
  if (booking.status !== "CHECKED_OUT" || !booking.checkedOutAt) return true;
  return now.getTime() <= booking.checkedOutAt.getTime() + DISPUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}
