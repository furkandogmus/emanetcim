/**
 * Geç teslim uyarısının KAÇINCI kez gönderilmesi gerektiği — saf hesap.
 *
 * NEDEN VAR (2026-09-01'de ölçüldü): `booking-reminders` işi geç teslim
 * uyarısını `status: CHECKED_IN, checkOutTime < now - 30dk` sorgusuyla
 * gönderiyordu ve **hiçbir tekrar kontrolü yoktu**. İş günde bir çalışıyor,
 * yani aynı rezervasyon için esnafa **her gün, süresiz** aynı e-posta gidiyordu:
 * bir ay unutulmuş valiz = otuz özdeş e-posta.
 *
 * Zararı sadece gürültü değil: esnafı platform e-postalarını görmezden gelmeye
 * alıştırır, ve o alışkanlık YENİ REZERVASYON bildirimini de öldürür — esnafın
 * işini başlatan tek şeyi.
 *
 * Aynı kod tabanında doğru kalıp ZATEN VAR: `OverdueBookingService` açıkça
 * idempotenttir ("aynı rezervasyon için aynı eşikte ikinci kez olay yazmaz") ve
 * eşiklerle çalışır. Niyet tekti, iki yerden yalnızca birinde uygulanmıştı.
 */

/**
 * Uyarı eşikleri (saat cinsinden gecikme).
 *
 * İLK EŞİK 0,5 SAAT — `OverdueBookingService.OVERDUE_TIERS` 24 saatten başlar
 * ama burada esnafın HIZLI haber alması gerekiyor: rafındaki valizin sahibi
 * gelmediyse bunu ertesi gün değil, yarım saat sonra bilmeli. Sonraki eşikler
 * o servisin eşikleriyle aynı hizada.
 */
export const OVERDUE_NOTICE_THRESHOLDS_HOURS = [0.5, 24, 72, 168, 720] as const;

/** Bu gecikme süresinde toplam KAÇ uyarı gönderilmiş olmalı. */
export function expectedOverdueNoticeCount(overdueHours: number): number {
  if (!Number.isFinite(overdueHours)) return 0;
  return OVERDUE_NOTICE_THRESHOLDS_HOURS.filter((t) => overdueHours >= t).length;
}

/**
 * Şimdi bir uyarı gönderilmeli mi?
 *
 * @param overdueHours planlanan çıkıştan bu yana geçen saat
 * @param alreadySent  bu rezervasyon için daha önce gönderilmiş uyarı sayısı
 */
export function shouldSendOverdueNotice(
  overdueHours: number,
  alreadySent: number,
): boolean {
  return alreadySent < expectedOverdueNoticeCount(overdueHours);
}

/**
 * Uyarı e-postasının konu ÖNEKİ. Tekrar sayımı buna göre yapıldığı için
 * ortak sabit: konu metni değişirse sayım sessizce sıfırlanır ve gürültü geri
 * gelir.
 */
export const OVERDUE_NOTICE_SUBJECT_PREFIX = "BagajPark: Geç teslim";
