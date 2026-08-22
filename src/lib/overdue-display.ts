/**
 * Bir rezervasyonun ne kadar süredir açık kaldığını KULLANICIYA GÖSTERİLEBİLİR
 * biçimde hesaplar.
 *
 * NEDEN VAR: 2026-08-22'de prod'da 19 rezervasyonun 18'i çıkış saatini geçmiş
 * hâlde açıktı ve hiçbiri hiç `CHECKED_OUT` olmamıştı; üç müşterinin bavulu
 * Haziran'dan beri "dükkanda" görünüyordu (P1-6, P1-22).
 *
 * Kodu okuyarak doğruladım: partner panelindeki çıkış butonu **var**, listede
 * tarih filtresi **yok**, yani Haziran'dan kalan rezervasyonlar butonuyla birlikte
 * ekranda duruyor. Sorun görünürlük değil, **ayırt edilebilirlik**: o rezervasyon
 * listede dünkü bir rezervasyondan hiçbir farkla görünmüyordu. Partnere "burada
 * bekleyen bir iş var" diyen hiçbir sinyal yoktu.
 *
 * `OverdueBookingService` aynı eşikleri sunucu tarafında kullanıyor; bu modül
 * onun kullanıcıya bakan karşılığı.
 */

export type OverdueSeverity = "none" | "due" | "late" | "critical";

const HOUR_MS = 60 * 60 * 1000;

export type OverdueInfo = {
  severity: OverdueSeverity;
  /** Çıkış saatinin üzerinden geçen tam saat. Gecikme yoksa 0. */
  overdueHours: number;
  /** Gün olarak, gösterimde kullanmak için. */
  overdueDays: number;
};

/**
 * Eşikler `OverdueBookingService.OVERDUE_TIERS` ile hizalı:
 *   < 24s  → `due`      (normal operasyon toleransı; sarı değil, nötr uyarı)
 *   ≥ 24s  → `late`
 *   ≥ 72s  → `critical` (bir hafta sonu tamamen geçmiş ve kimse dokunmamış)
 */
export function computeOverdue(
  scheduledCheckOut: Date | string,
  now: Date = new Date(),
): OverdueInfo {
  const end =
    scheduledCheckOut instanceof Date
      ? scheduledCheckOut
      : new Date(scheduledCheckOut);
  const ms = now.getTime() - end.getTime();
  if (!Number.isFinite(ms) || ms <= 0) {
    return { severity: "none", overdueHours: 0, overdueDays: 0 };
  }
  const overdueHours = Math.floor(ms / HOUR_MS);
  const overdueDays = Math.floor(overdueHours / 24);
  const severity: OverdueSeverity =
    overdueHours >= 72 ? "critical" : overdueHours >= 24 ? "late" : "due";
  return { severity, overdueHours, overdueDays };
}
