/**
 * Dükkanın "yanıt süresi" rozetinin ARKASINDAKİ hesap.
 *
 * NEDEN VAR (P2-7, 2026-08-24): `Shop.responseTimeMinutes` şemada vardı, rozet
 * arama ve dükkan detayında çiziliyordu, ama `src/` içinde bu kolonu YAZAN tek
 * bir kod yolu yoktu — platform genelinde değer 0'dı. Yani rozet ya hiç
 * görünmüyordu ya da (elle bir sayı girilseydi) hiçbir şeye dayanmayan bir
 * güven iddiası olacaktı. Güven rozeti ölçülmüş bir sayıya dayanmalı, yoksa
 * hiç gösterilmemeli.
 *
 * Ölçüm: misafirin talebi oluşturduğu an (`Booking.createdAt`) ile esnafın onay
 * verdiği an (`BookingEvent` `APPROVED`) arasındaki dakika farkı.
 */

/** Bu kadar günden eski onaylar hesaba katılmaz — rozet GÜNCEL davranışı anlatmalı. */
export const RESPONSE_TIME_LOOKBACK_DAYS = 90;

/**
 * Bu sayıdan az örneği olan dükkan için değer YAZILMAZ (`null`).
 *
 * Tek bir hızlı onaydan "bu dükkan 4 dakikada yanıtlar" sonucu çıkarmak, rozeti
 * yine karşılıksız bir iddiaya çevirirdi — sadece bu kez sayıyı biz uydurmuş
 * oluruz.
 */
export const RESPONSE_TIME_MIN_SAMPLES = 5;

/** Tek bir uzun tatilin ortalamayı bozmaması için üstten kırpma. */
export const RESPONSE_TIME_MAX_SAMPLES = 50;

/**
 * Rozet "≤ X dk" diyor — yani bir ÜST SINIR iddiası. Bu yüzden ortanca değil
 * p90 kullanılıyor: metin, örneklerin %90'ı için doğru kalır. Ortanca
 * kullanılsaydı iddia yarı yarıya yanlış olurdu.
 */
export function p90Minutes(samples: readonly number[]): number | null {
  const valid = samples
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => a - b);
  if (valid.length < RESPONSE_TIME_MIN_SAMPLES) return null;

  const idx = Math.min(valid.length - 1, Math.ceil(valid.length * 0.9) - 1);
  // En az 1 dk: 0, "veri yok" anlamına gelen şema varsayılanıyla karışırdı.
  return Math.max(1, Math.round(valid[idx]));
}

/** İki an arasındaki dakika farkı; negatif (saat sapması) örnekler elenir. */
export function minutesBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 60_000;
}
