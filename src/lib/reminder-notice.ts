/**
 * Yaklaşan rezervasyon hatırlatmalarının konu ÖNEKLERİ.
 *
 * NEDEN AYRI SABİT (2026-09-02): tekrar kontrolü `NotificationLog.subject`
 * üzerinden yapılıyor. Konu metni gönderim yerinde elle yazılırsa, biri onu
 * değiştirdiği anda sayım sessizce sıfırlanır ve aynı misafire her çalışmada
 * yeniden e-posta gider. Aynı gerekçe `overdue-notice.ts`de de yazılı; bu
 * dosya onun kardeşi.
 */
export const CHECK_IN_REMINDER_SUBJECT_PREFIX =
  "BagajPark: Check-in zamanınız yaklaşıyor";

export const CHECK_OUT_REMINDER_SUBJECT_PREFIX =
  "BagajPark: Valizinizi alma zamanı";

/**
 * Hatırlatma penceresi (dakika).
 *
 * NEDEN VAR (2026-09-02'de ölçüldü): pencereler `booking-reminders` ucunda
 * çıplak sayı olarak duruyordu (`2 * 60 * 60 * 1000`) ve işin GERÇEK
 * periyoduyla ilişkileri hiçbir yerde yazmıyordu. Uç dosyasının başlığı "her
 * 15 dakikada bir çalışacak şekilde tasarlanmıştır" derken `jobs/registry.ts`
 * onu `7 9 * * *` ile GÜNDE BİR koşturuyordu.
 *
 * Sonuç sessiz bir kapsama boşluğuydu: iş 09:07'de bir kez çalışıp yalnızca
 * 09:07–11:07 arasında check-in yapacakları buluyordu. Günün kalan 22 saatinde
 * check-in yapan hiçbir misafir hatırlatma ALMIYORDU -- işin kayıt defterindeki
 * gerekçesi ("misafir check-in saatini kaçırır, no-show artar") tam olarak
 * gerçekleşiyor, iş ise her gün "başarılı" raporluyordu.
 *
 * Pencere periyottan BÜYÜK olmak zorunda: iki çalışma arasına düşen hiçbir
 * rezervasyon atlanmasın. Büyük olduğu için de aynı rezervasyon arka arkaya
 * birden çok çalışmada pencereye girer -- tekrar kontrolü bu yüzden şart,
 * pencereyi daraltmak değil. Daraltmak, ilk baştaki hatanın kendisi.
 */
export const CHECK_IN_REMINDER_WINDOW_MINUTES = 120;
export const CHECK_OUT_REMINDER_WINDOW_MINUTES = 60;
